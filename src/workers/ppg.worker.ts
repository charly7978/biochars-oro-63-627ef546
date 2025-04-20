// src/workers/ppg.worker.ts

// Import necessary types (adjust path if needed)
import { ProcessedSignal } from '../types/signal.d'; // Assuming signal.d.ts is the correct location

// Define ROI settings (can be made configurable later)
const ROI_SETTINGS = {
  widthPercent: 0.4, // Use central 40% width
  heightPercent: 0.4, // Use central 40% height
};

/**
 * Procesador de señales PPG (Fotopletismografía) adaptado para Web Worker
 *
 * Procesa frames de cámara para detectar y filtrar señales PPG del dedo.
 * Implementa detección de dedo, filtrado básico, análisis de calidad y procesamiento ROI.
 * Se ejecuta en un hilo separado para no bloquear la UI.
 */
class PPGWorkerProcessor {
  // Estado del procesador
  private isProcessing: boolean = false;
  private frameCount: number = 0;

  // Buffers y referencias para procesamiento
  private readonly signalBuffer: number[] = [];
  private readonly BUFFER_SIZE = 100; // Mantener o ajustar según necesidad
  private readonly redBuffer: number[] = [];
  private readonly greenBuffer: number[] = [];
  private readonly blueBuffer: number[] = [];

  // Parámetros de procesamiento (ajustados o simplificados del original)
  private readonly MIN_PIXEL_VALUE = 10; // Umbral mínimo de brillo
  private readonly RED_DOMINANCE_THRESHOLD = 1.1; // Rojo debe ser al menos 10% más brillante que verde/azul
  private readonly MIN_RED_VALUE = 80; // Umbral mínimo absoluto para el canal rojo en ROI (bajado de 130 a 80)
  private readonly MIN_FINGER_FRAMES = 5; // Aumentado ligeramente para estabilidad

  // Filtros y constantes
  private readonly FILTER_ALPHA = 0.1; // Filtro paso-bajo simple (puede mejorarse)
  private qualityScore: number = 0;
  private readonly QUALITY_DECAY = 0.9; // Decaimiento más rápido si la señal empeora

  // Contadores para detección
  private consecutiveFingerFrames: number = 0;
  private consecutiveNoFingerFrames: number = 0;

  constructor() {
    this.reset();
    console.log("PPG Worker Initialized");
  }

  /**
  * Reinicia todos los buffers y estados
  */
  private reset(): void {
    this.signalBuffer.length = 0;
    this.redBuffer.length = 0;
    this.greenBuffer.length = 0;
    this.blueBuffer.length = 0;
    this.frameCount = 0;
    this.qualityScore = 0;
    this.consecutiveFingerFrames = 0;
    this.consecutiveNoFingerFrames = 0;
  }

  /**
  * Inicia el procesamiento
  */
  public start(): void {
    if (this.isProcessing) return;
    console.log("PPG Worker: Starting processing");
    this.isProcessing = true;
    this.reset();
  }

  /**
  * Detiene el procesamiento
  */
  public stop(): void {
    console.log("PPG Worker: Stopping processing");
    this.isProcessing = false;
  }

  /**
   * Procesa un frame de imagen recibido por el worker
   */
  public processFrame(imageData: ImageData): void {
    if (!this.isProcessing) return;
    this.frameCount++;

    try {
      const { avgRed, avgGreen, avgBlue, isFingerDetected } = this.extractSignalFromROI(imageData);
      console.log('[PPGWorker] avgRed:', avgRed, 'isFingerDetected:', isFingerDetected);

      // Actualizar conteo de detección de dedo
      if (isFingerDetected) {
          this.consecutiveFingerFrames++;
          this.consecutiveNoFingerFrames = 0;
      } else {
          this.consecutiveNoFingerFrames++;
          this.consecutiveFingerFrames = 0;
      }

      // Confirmar detección solo después de varios frames
      const fingerConfirmed = this.consecutiveFingerFrames >= this.MIN_FINGER_FRAMES;

      let rawValue = 0;
      let filteredValue = 0;
      let quality = 0;

      if (fingerConfirmed) {
          // Usar el promedio del canal rojo como señal cruda (simple, se puede mejorar)
          rawValue = avgRed;

          // Actualizar buffer de señal
          this.signalBuffer.push(rawValue);
          if (this.signalBuffer.length > this.BUFFER_SIZE) {
              this.signalBuffer.shift();
          }

          // Aplicar filtro paso-bajo simple
          // (Nota: el filtro necesita historial, podríamos implementarlo mejor o pasar el buffer)
          // Por ahora, usaremos una versión simplificada o la última señal.
          // Una mejor implementación usaría el buffer:
          filteredValue = this.applySimpleLowPass(rawValue); // Requerirá implementación o mejora

          // Calcular calidad (simplificado, necesita mejora robusta)
          quality = this.calculateSignalQuality(avgRed, avgGreen, avgBlue);
          this.qualityScore = quality; // Actualizar puntuación

          // Actualizar buffers de colores (si se usan para análisis futuro)
          this.redBuffer.push(avgRed);
          if (this.redBuffer.length > this.BUFFER_SIZE) this.redBuffer.shift();
          // ... (similar para greenBuffer, blueBuffer si es necesario)

      } else {
          // Si no hay dedo o no está confirmado, resetear calidad
          this.qualityScore = this.qualityScore * this.QUALITY_DECAY; // Decaer gradualmente
          quality = Math.max(0, Math.floor(this.qualityScore)); // Asegurar que no sea negativo
          // Resetear valores si no hay dedo
          rawValue = 0;
          filteredValue = 0;
          this.signalBuffer.length = 0; // Limpiar buffer si se pierde el dedo
      }


      // Emitir señal procesada al hilo principal
      const processedSignal: ProcessedSignal = {
          rawValue: rawValue,
          filteredValue: filteredValue, // Usar el valor filtrado calculado
          quality: quality,
          fingerDetected: fingerConfirmed,
          timestamp: Date.now(),
          // Añadir propiedad ROI requerida (valores placeholder o reales si se calculan)
          roi: { x: 0, y: 0, width: 0, height: 0 }, // O usar roiX, roiY, roiWidth, roiHeight si están disponibles aquí
          // Incluir otros campos si son necesarios o calculados
      };
      self.postMessage(processedSignal);

    } catch (error) {
        console.error("PPG Worker: Error processing frame:", error);
        // Podríamos enviar un mensaje de error al hilo principal si es necesario
        // self.postMessage({ error: 'Failed to process frame' });
    }
  }

  /**
  * Extrae la señal PPG promediando píxeles en una Región de Interés (ROI) central.
  * Implementa lógica básica de detección de dedo basada en color.
  */
  private extractSignalFromROI(imageData: ImageData): { avgRed: number; avgGreen: number; avgBlue: number; isFingerDetected: boolean; } {
    const { data, width, height } = imageData;

    // Calcular límites de la ROI
    const roiWidth = Math.floor(width * ROI_SETTINGS.widthPercent);
    const roiHeight = Math.floor(height * ROI_SETTINGS.heightPercent);
    const roiX = Math.floor((width - roiWidth) / 2);
    const roiY = Math.floor((height - roiHeight) / 2);

    let sumRed = 0;
    let sumGreen = 0;
    let sumBlue = 0;
    let pixelCountInROI = 0;

    // Iterar solo sobre los píxeles dentro de la ROI
    for (let y = roiY; y < roiY + roiHeight; y++) {
      for (let x = roiX; x < roiX + roiWidth; x++) {
        const index = (y * width + x) * 4; // Índice base del píxel (R, G, B, A)
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        // Aplicar umbral mínimo de brillo para evitar píxeles oscuros/ruido
        if (r > this.MIN_PIXEL_VALUE || g > this.MIN_PIXEL_VALUE || b > this.MIN_PIXEL_VALUE) {
            sumRed += r;
            sumGreen += g;
            sumBlue += b;
            pixelCountInROI++;
        }
      }
    }

    if (pixelCountInROI === 0) {
        // Evitar división por cero si la ROI está completamente oscura o vacía
        return { avgRed: 0, avgGreen: 0, avgBlue: 0, isFingerDetected: false };
    }

    // Calcular promedios
    const avgRed = sumRed / pixelCountInROI;
    const avgGreen = sumGreen / pixelCountInROI;
    const avgBlue = sumBlue / pixelCountInROI;

    // Lógica de detección de dedo (simplificada, basada en dominancia roja y umbral mínimo)
    const isRedDominant = avgRed > avgGreen * this.RED_DOMINANCE_THRESHOLD && avgRed > avgBlue * this.RED_DOMINANCE_THRESHOLD;
    const isRedSufficient = avgRed >= this.MIN_RED_VALUE;
    const isFingerDetected = isRedDominant && isRedSufficient && pixelCountInROI > (roiWidth * roiHeight * 0.5); // Asegurar que una porción significativa de la ROI tenga señal

    return { avgRed, avgGreen, avgBlue, isFingerDetected };
  }

   /**
   * Aplica un filtro paso-bajo simple (Promedio Móvil Exponencial).
   * Necesita acceso al valor anterior para funcionar correctamente.
   * Esta es una implementación básica, se puede mejorar usando el buffer.
   */
  private applySimpleLowPass(currentValue: number): number {
      // Usar el último valor del buffer si existe, sino el valor actual
      const previousValue = this.signalBuffer.length > 1 ? this.signalBuffer[this.signalBuffer.length - 2] : currentValue;
      return this.FILTER_ALPHA * currentValue + (1 - this.FILTER_ALPHA) * previousValue;
  }


  /**
   * Calcula una puntuación de calidad básica.
   * (Debe mejorarse significativamente en Fase 2)
   */
   private calculateSignalQuality(r: number, g: number, b: number): number {
       // Ejemplo muy básico: Penalizar si no hay fuerte dominancia roja
       // O si los valores son muy bajos.
       const redDominanceFactor = Math.max(0, Math.min(1, (r / (g + b + 0.1)) - 0.5)); // Simple medida de dominancia
       const brightnessFactor = Math.max(0, Math.min(1, (r + g + b) / (255 * 3 * 0.5))); // Penalizar baja luminosidad general

       // Una métrica muy simple por ahora:
       let score = 50 * redDominanceFactor + 50 * brightnessFactor;

       // Actualizar la puntuación global con decaimiento
        this.qualityScore = Math.max(0, Math.min(100, this.qualityScore * this.QUALITY_DECAY + score * (1 - this.QUALITY_DECAY)));

       return Math.floor(this.qualityScore); // Devolver entero 0-100
   }

}

// --- Lógica del Worker ---
let processor: PPGWorkerProcessor | null = null;

self.onmessage = (event: MessageEvent) => {
  const { command, payload } = event.data;

  if (command === 'start') {
    processor = new PPGWorkerProcessor();
    processor.start();
  } else if (command === 'stop') {
    processor?.stop();
    processor = null; // Liberar instancia
  } else if (command === 'processFrame' && processor && payload instanceof ImageData) {
    processor.processFrame(payload);
  } else if (command === 'config') {
      // Aquí podríamos manejar la configuración de parámetros (ROI, filtros, etc.)
      console.log("PPG Worker: Config received (implement handler)", payload);
  }
};

// Señalizar que el worker está listo (opcional)
// self.postMessage({ status: 'ready' });

console.log("ppg.worker.ts loaded"); 