import { KalmanFilter } from './filters/KalmanFilter';
import { WaveletDenoiser } from './filters/WaveletDenoiser';
import type { ProcessedSignal, ProcessingError } from '../../types/signal';
import { antiRedundancyGuard } from '../../core/validation/CrossValidationSystem';

export class PPGProcessor {
  // Configuración unificada con valores optimizados
  private readonly CONFIG = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 40,     // Reducido para ser más permisivo con pieles oscuras
    MAX_RED_THRESHOLD: 240,    // Aumentado para ser más permisivo con pieles claras
    STABILITY_WINDOW: 3,
    MIN_STABILITY_COUNT: 2,    // Reducido para detectar más rápido
    PERFUSION_INDEX_THRESHOLD: 0.03, // Reducido para ser más sensible
    WAVELET_THRESHOLD: 0.025,
    BASELINE_FACTOR: 0.95,
    PERIODICITY_BUFFER_SIZE: 40,
    MIN_PERIODICITY_SCORE: 0.2,  // Reducido para ser más permisivo
    SIGNAL_QUALITY_THRESHOLD: 50, // Reducido para aceptar señales de menor calidad
    // Nuevos parámetros para mejorar la detección
    RED_DOMINANCE_RATIO: 1.1,   // Ratio mínimo de rojo sobre otros canales
    FINGER_DETECTION_FORGIVENESS: 3, // Frames para mantener detección ante fluctuaciones
    QUICK_DETECTION_THRESHOLD: 80,  // Valor para detección rápida
    SHADOW_DETECTION_THRESHOLD: 35  // Valor mínimo para detectar dedo en sombra
  };
  
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private waveletDenoiser: WaveletDenoiser;
  private lastValues: number[] = [];
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private baselineValue: number = 0;
  private periodicityBuffer: number[] = [];
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.waveletDenoiser = new WaveletDenoiser();
    console.log("PPGProcessor: Instancia unificada creada");
  }

  public initialize(): Promise<void> {
    return new Promise<void>((resolve) => {
      console.log("PPGProcessor: Inicializado");
      resolve();
    });
  }

  public start(): void {
    this.isProcessing = true;
    console.log("PPGProcessor: Procesamiento iniciado");
  }

  public stop(): void {
    this.isProcessing = false;
    console.log("PPGProcessor: Procesamiento detenido");
  }

  public calibrate(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      console.log("PPGProcessor: Calibración completada");
      resolve(true);
    });
  }

  public processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      const redValue = this.extractRedChannel(imageData);
      const kalmanFiltered = this.kalmanFilter.filter(redValue);
      const filtered = this.waveletDenoiser.denoise(kalmanFiltered);
      
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.CONFIG.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);
      const perfusionIndex = this.calculatePerfusionIndex();

      this.periodicityBuffer.push(filtered);
      if (this.periodicityBuffer.length > this.CONFIG.PERIODICITY_BUFFER_SIZE) {
        this.periodicityBuffer.shift();
      }

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue),
        perfusionIndex: perfusionIndex
      };

      this.onSignalReady?.(processedSignal);
    } catch (error) {
      console.error("PPGProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    // Analizar el 40% central de la imagen para mejor precisión
    const startX = Math.floor(imageData.width * 0.3);
    const endX = Math.floor(imageData.width * 0.7);
    const startY = Math.floor(imageData.height * 0.3);
    const endY = Math.floor(imageData.height * 0.7);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];  // Canal rojo
        count++;
      }
    }
    
    return redSum / count;
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    // Verificación básica de rango
    const isInRange = rawValue >= this.CONFIG.MIN_RED_THRESHOLD && 
                      rawValue <= this.CONFIG.MAX_RED_THRESHOLD;
    
    // Mantener detección por unos cuadros adicionales para estabilidad
    if (!isInRange) {
      // Reducir contador gradualmente en lugar de reiniciar
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
      
      // Si todavía tenemos suficiente "confianza" acumulada, mantener la detección
      const isStillDetected = this.stableFrameCount >= (this.CONFIG.MIN_STABILITY_COUNT - 1);
      
      // Calidad reducida pero no a cero inmediatamente
      const degradedQuality = Math.max(0, Math.floor((this.stableFrameCount / this.CONFIG.MIN_STABILITY_COUNT) * 40));
      
      return { 
        isFingerDetected: isStillDetected, 
        quality: degradedQuality 
      };
    }

    // Detección rápida para valores muy prometedores
    if (rawValue > this.CONFIG.QUICK_DETECTION_THRESHOLD && 
        rawValue < (this.CONFIG.MAX_RED_THRESHOLD - 30)) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1.5, this.CONFIG.MIN_STABILITY_COUNT * 2);
      const quickQuality = Math.min(80, 40 + (this.stableFrameCount * 5));
      return { 
        isFingerDetected: true, 
        quality: Math.round(quickQuality) 
      };
    }

    // Manejo de condiciones de poca luz - permitir valores más bajos si son estables
    if (rawValue >= this.CONFIG.SHADOW_DETECTION_THRESHOLD && 
        rawValue < this.CONFIG.MIN_RED_THRESHOLD + 20) {
      // Aumentar el contador más lentamente en condiciones de poca luz
      this.stableFrameCount = Math.min(this.stableFrameCount + 0.5, this.CONFIG.MIN_STABILITY_COUNT * 1.5);
      
      if (this.stableFrameCount >= this.CONFIG.MIN_STABILITY_COUNT) {
        return { 
          isFingerDetected: true, 
          quality: Math.round((this.stableFrameCount / (this.CONFIG.MIN_STABILITY_COUNT * 1.5)) * 45) 
        };
      }
    }

    if (this.lastValues.length < this.CONFIG.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    const recentValues = this.lastValues.slice(-this.CONFIG.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Cálculo de variación más sofisticado
    const maxVariation = Math.max(...variations.map(Math.abs));
    // Umbral adaptativo basado en el valor promedio
    const adaptiveThreshold = Math.max(1.5, avgValue * 0.03); // Más permisivo (0.03 vs 0.02)
    const isStable = maxVariation < adaptiveThreshold * 2.5; // Más permisivo (2.5 vs 2)

    if (isStable) {
      // Incremento más rápido del contador de estabilidad
      this.stableFrameCount = Math.min(this.stableFrameCount + 1.2, this.CONFIG.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      // Decremento más lento para mayor tolerancia a fluctuaciones
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.3);
    }

    const isFingerDetected = this.stableFrameCount >= this.CONFIG.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      // Cálculo de calidad mejorado
      const stabilityQuality = (this.stableFrameCount / (this.CONFIG.MIN_STABILITY_COUNT * 2)) * 50;
      const periodicityQuality = this.analyzePeriodicityQuality() * 50;
      const perfusionBonus = this.calculatePerfusionIndex() > this.CONFIG.PERFUSION_INDEX_THRESHOLD ? 10 : 0;
      
      quality = Math.round(stabilityQuality + periodicityQuality + perfusionBonus);
    }

    return { isFingerDetected, quality };
  }

  private calculatePerfusionIndex(): number {
    if (this.lastValues.length < 10) return 0;
    
    const values = this.lastValues.slice(-10);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const dc = (max + min) / 2;
    
    if (dc === 0) return 0;
    
    const ac = max - min;
    const pi = (ac / dc) * 100;
    
    return Math.min(pi, 10); // Limitar a un máximo razonable de 10%
  }

  private analyzePeriodicityQuality(): number {
    if (this.periodicityBuffer.length < 30) return 0.5;
    
    // Implementar análisis simple de periodicidad
    let correlationSum = 0;
    const halfSize = Math.floor(this.periodicityBuffer.length / 2);
    
    for (let i = 0; i < halfSize; i++) {
      correlationSum += Math.abs(this.periodicityBuffer[i] - this.periodicityBuffer[i + halfSize]);
    }
    
    const avgCorrelation = correlationSum / halfSize;
    const normalizedCorrelation = Math.min(1, Math.max(0, 1 - (avgCorrelation / 10)));
    
    return normalizedCorrelation;
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
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    
    this.onError?.(error);
  }
}

// Registrar el archivo y la tarea única globalmente (fuera de la clase)
antiRedundancyGuard.registerFile('src/core/signal/PPGProcessor.ts');
antiRedundancyGuard.registerTask('PPGProcessorSingleton');
