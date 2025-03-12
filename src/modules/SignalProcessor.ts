import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

class KalmanFilter {
  private R: number = 0.01;
  private Q: number = 0.1;
  private P: number = 1;
  private X: number = 0;
  private K: number = 0;

  filter(measurement: number): number {
    this.P = this.P + this.Q;
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    return this.X;
  }

  reset() {
    this.X = 0;
    this.P = 1;
  }
}

export class PPGSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private lastValues: number[] = [];
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 60,     // Aumentado de 40 a 60 para exigir una señal más fuerte
    MAX_RED_THRESHOLD: 250,
    STABILITY_WINDOW: 6,
    MIN_STABILITY_COUNT: 6,    // Aumentado de 4 a 6 para requerir más muestras estables
    HYSTERESIS: 5,
    MIN_CONSECUTIVE_DETECTIONS: 3,
    MIN_CONFIDENCE: 0.6        // Definimos MIN_CONFIDENCE que estaba faltando
  };

  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private readonly DETECTION_TIMEOUT = 500; // 500ms timeout

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.consecutiveDetections = 0;
      this.isCurrentlyDetected = false;
      this.lastDetectionTime = 0;
      this.kalmanFilter.reset();
      console.log("PPGSignalProcessor: Inicializado");
    } catch (error) {
      console.error("PPGSignalProcessor: Error de inicialización", error);
      this.handleError("INIT_ERROR", "Error al inicializar el procesador");
    }
  }

  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Iniciado");
  }

  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.consecutiveDetections = 0;
    this.isCurrentlyDetected = false;
    this.kalmanFilter.reset();
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración");
      await this.initialize();
      console.log("PPGSignalProcessor: Calibración completada");
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Error de calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error durante la calibración");
      return false;
    }
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Extraer y procesar el canal rojo (el más importante para PPG)
      const redValue = this.extractRedChannel(imageData);
      
      // Aplicar filtro Kalman para suavizar la señal y reducir el ruido
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Análisis avanzado de la señal para determinar la presencia del dedo y calidad
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);
      
      // Calcular coordenadas del ROI (región de interés)
      const roi = this.detectROI(redValue);
      
      // Métricas adicionales para debugging y análisis
      const perfusionIndex = redValue > 0 ? 
        Math.abs(filtered - this.lastStableValue) / Math.max(1, redValue) : 0;
      
      // Crear objeto de señal procesada con todos los datos relevantes
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: roi,
        perfusionIndex: perfusionIndex
      };
      
      // Enviar feedback sobre el uso de la linterna cuando es necesario
      if (isFingerDetected && quality < 40 && redValue < 120 && this.onError) {
        // Señal detectada pero débil - podría indicar poca iluminación
        this.onError({
          code: "LOW_LIGHT",
          message: "Señal débil. Por favor asegúrese de que la linterna esté encendida y el dedo cubra completamente la cámara.",
          timestamp: Date.now()
        });
      }
      
      // Advertir si hay sobreexposición (saturación) que afecta la calidad
      if (isFingerDetected && redValue > 240 && this.onError) {
        this.onError({
          code: "OVEREXPOSED",
          message: "La imagen está sobreexpuesta. Intente ajustar la posición del dedo para reducir el brillo.",
          timestamp: Date.now()
        });
      }
      
      // Enviar la señal procesada al callback
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
      
      // Almacenar el último valor procesado para cálculos futuros
      this.lastStableValue = isFingerDetected ? filtered : this.lastStableValue;

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    let maxRed = 0;
    let minRed = 255;
    
    // Optimización 1: Enfocarse en el centro de la imagen donde normalmente está el dedo
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * 0.4; // Aumentado de 0.3 a 0.4 para mayor área de captura
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
    // Optimización 2: Usar una matriz para encontrar la región con mejor señal
    const regionSize = 8; // Reducido de 10 a 8 para más regiones
    const regions: Record<string, {redSum: number, count: number, x: number, y: number, ratio: number}> = {};
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        const r = data[i];     // Canal rojo
        const g = data[i+1];   // Canal verde
        const b = data[i+2];   // Canal azul
        
        // Optimización 3: Mejora en criterio de detección de dominancia roja (PPG)
        // Menos restrictivo en el factor (1.1 → 1.05) pero aún exigiendo dominancia roja
        const redToGreen = r / Math.max(1, g);
        const redToBlue = r / Math.max(1, b);
        
        if (redToGreen > 1.05 && redToBlue > 1.05) {
          redSum += r;
          greenSum += g;
          blueSum += b;
          pixelCount++;
          
          // Registrar valores máximos y mínimos para calcular contraste
          maxRed = Math.max(maxRed, r);
          minRed = Math.min(minRed, r);
          
          // Registrar región para análisis avanzado
          const regionX = Math.floor((x - startX) / regionSize);
          const regionY = Math.floor((y - startY) / regionSize);
          const regionKey = `${regionX},${regionY}`;
          
          if (!regions[regionKey]) {
            regions[regionKey] = {
              redSum: 0,
              count: 0,
              x: regionX,
              y: regionY,
              ratio: 0
            };
          }
          
          regions[regionKey].redSum += r;
          regions[regionKey].count++;
          // Calcular ratio R/(G+B) como indicador de calidad de PPG
          regions[regionKey].ratio = (regions[regionKey].ratio * (regions[regionKey].count - 1) + (r / Math.max(1, g + b))) / regions[regionKey].count;
        }
      }
    }
    
    // Optimización 4: Reducir umbral mínimo de píxeles para permitir detección con dedos más pequeños o parcialmente colocados
    if (pixelCount < 30) { // Reducido de 50 a 30
      return 0;
    }
    
    // Optimización 5: Mejorar la búsqueda de la mejor región incluyendo ratio PPG
    let bestRegion = null;
    let bestScore = 0;
    
    for (const key in regions) {
      const region = regions[key];
      if (region.count > 8) {  // Reducido de 10 a 8
        const avgRed = region.redSum / region.count;
        // Puntaje que combina intensidad y calidad PPG
        const score = avgRed * 0.7 + (region.ratio * 100) * 0.3;
        if (score > bestScore) {
          bestScore = score;
          bestRegion = region;
        }
      }
    }
    
    // Optimización 6: Si encontramos una buena región, dar más peso a su valor
    if (bestRegion && bestScore > 90) { // Reducido de 100 a 90
      return bestScore;
    }
    
    // Cálculo estándar mejorado para casos sin región óptima
    const avgRed = redSum / Math.max(1, pixelCount);
    const avgGreen = greenSum / Math.max(1, pixelCount);
    const avgBlue = blueSum / Math.max(1, pixelCount);
    
    // Optimización 7: Criterios mejorados para detección general
    const isRedDominant = avgRed > (avgGreen * 1.1) && avgRed > (avgBlue * 1.1);
    const hasGoodContrast = pixelCount > 50 && (maxRed - minRed) > 10; // Reducido de 15 a 10
    const isInRange = avgRed > 40 && avgRed < 250; // Rango ampliado (de 50-250 a 40-250)
    
    // Optimización 8: Combinar criterios con ponderación para mejorar sensibilidad
    const detectionScore = 
      (isRedDominant ? 1 : 0) * 0.5 + 
      (hasGoodContrast ? 1 : 0) * 0.3 + 
      (isInRange ? 1 : 0) * 0.2;
    
    return (detectionScore >= 0.7) ? avgRed : 0; // Umbral reducido para mayor sensibilidad
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const currentTime = Date.now();
    const timeSinceLastDetection = currentTime - this.lastDetectionTime;
    
    // Si el valor de entrada es 0 (no se detectó dominancia de rojo), definitivamente no hay dedo
    if (rawValue <= 0) {
      this.consecutiveDetections = 0;
      this.stableFrameCount = 0;
      this.isCurrentlyDetected = false;
      return { isFingerDetected: false, quality: 0 };
    }
    
    // Verificar si el valor está dentro del rango válido con histéresis para evitar oscilaciones
    // La histéresis permite mantener la detección incluso con pequeñas fluctuaciones
    const inRange = this.isCurrentlyDetected
      ? rawValue >= (this.currentConfig.MIN_RED_THRESHOLD - this.currentConfig.HYSTERESIS) &&
        rawValue <= (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.HYSTERESIS)
      : rawValue >= this.currentConfig.MIN_RED_THRESHOLD &&
        rawValue <= this.currentConfig.MAX_RED_THRESHOLD;

    if (!inRange) {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1);
      
      // Solo cancelamos la detección después de un tiempo para evitar falsos negativos por fluctuaciones
      if (timeSinceLastDetection > this.DETECTION_TIMEOUT && this.consecutiveDetections === 0) {
        this.isCurrentlyDetected = false;
      }
      
      // Si aún tenemos detección pero la calidad es baja, reportamos calidad reducida
      const quality = this.isCurrentlyDetected ? Math.max(10, this.calculateStability() * 50) : 0;
      return { isFingerDetected: this.isCurrentlyDetected, quality };
    }

    // Calcular estabilidad temporal de la señal
    const stability = this.calculateStability();
    
    // Añadir el valor a nuestro historial para análisis
    this.lastValues.push(filtered);
    if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
      this.lastValues.shift();
    }
    
    // Actualizar contadores de estabilidad según la calidad de la señal
    if (stability > 0.8) {
      // Señal muy estable, incrementamos rápidamente
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1.5,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.6) {
      // Señal moderadamente estable
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.4) {
      // Señal con estabilidad media, incremento lento
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 0.5,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else {
      // Señal inestable
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    // Actualizar estado de detección
    const isStableNow = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;

    if (isStableNow) {
      this.consecutiveDetections++;
      if (this.consecutiveDetections >= this.currentConfig.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
        this.lastStableValue = filtered; // Guardar el último valor estable
      }
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.5);
    }

    // Calcular calidad de la señal considerando varios factores
    const stabilityScore = Math.min(1, this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2));
    
    // Puntaje por intensidad - evaluar si está en un rango óptimo (ni muy bajo ni saturado)
    const optimalValue = (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.MIN_RED_THRESHOLD) / 2;
    const distanceFromOptimal = Math.abs(rawValue - optimalValue) / optimalValue;
    const intensityScore = Math.max(0, 1 - distanceFromOptimal);
    
    // Puntaje por variabilidad - una buena señal PPG debe tener cierta variabilidad periódica
    let variabilityScore = 0;
    if (this.lastValues.length >= 5) {
      const variations = [];
      for (let i = 1; i < this.lastValues.length; i++) {
        variations.push(Math.abs(this.lastValues[i] - this.lastValues[i-1]));
      }
      
      const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
      // La variación óptima para PPG está entre 0.5 y 4 unidades
      variabilityScore = avgVariation > 0.5 && avgVariation < 4 ? 1 : 
                         avgVariation < 0.2 ? 0 : 
                         avgVariation > 10 ? 0 : 
                         0.5;
    }
    
    // Combinar los puntajes con diferentes pesos
    const qualityRaw = stabilityScore * 0.5 + intensityScore * 0.3 + variabilityScore * 0.2;
    
    // Escalar a 0-100 y redondear
    const quality = Math.round(qualityRaw * 100);
    
    // Aplicar umbral final - solo reportamos calidad si hay detección confirmada
    return {
      isFingerDetected: this.isCurrentlyDetected,
      quality: this.isCurrentlyDetected ? quality : 0
    };
  }

  private calculateStability(): number {
    if (this.lastValues.length < 2) return 0;
    
    const variations = this.lastValues.slice(1).map((val, i) => 
      Math.abs(val - this.lastValues[i])
    );
    
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
    return Math.max(0, Math.min(1, 1 - (avgVariation / 50)));
  }

  private detectROI(redValue: number): ProcessedSignal['roi'] {
    return {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    };
  }

  private handleError(code: string, message: string): void {
    console.error("PPGSignalProcessor: Error", code, message);
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    this.onError?.(error);
  }
}
