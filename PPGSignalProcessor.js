
import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

class KalmanFilter {
  private R: number = 0.008; // Reduced measurement noise for higher sensitivity
  private Q: number = 0.125; // Increased process noise for faster response
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
    BUFFER_SIZE: 10,
    MIN_RED_THRESHOLD: 75,  // Further reduced for higher sensitivity
    MAX_RED_THRESHOLD: 250, // Increased for wider detection range
    STABILITY_WINDOW: 4,    
    MIN_STABILITY_COUNT: 3  
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private readonly BUFFER_SIZE = 10;
  private readonly MIN_RED_THRESHOLD = 75;
  private readonly MAX_RED_THRESHOLD = 250;
  private readonly STABILITY_WINDOW = 5;
  private readonly MIN_STABILITY_COUNT = 3;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.04; // Further reduced for better detection

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada con parámetros calibrados");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.kalmanFilter.reset();
      console.log("PPGSignalProcessor: Inicializado con parámetros optimizados");
    } catch (error) {
      console.error("PPGSignalProcessor: Error de inicialización", error);
      this.handleError("INIT_ERROR", "Error al inicializar el procesador");
    }
  }

  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Iniciado con parámetros optimizados");
  }

  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.kalmanFilter.reset();
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración mejorada");
      await this.initialize();

      // Enhanced calibration process
      await new Promise(resolve => setTimeout(resolve, 1500)); // Shorter wait time
      
      // More adaptive threshold adjustment
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: Math.max(20, this.MIN_RED_THRESHOLD - 10),
        MAX_RED_THRESHOLD: Math.min(255, this.MAX_RED_THRESHOLD + 10),
        STABILITY_WINDOW: 4, // Reduced for faster detection
        MIN_STABILITY_COUNT: 2 // Reduced for higher sensitivity
      };

      console.log("PPGSignalProcessor: Calibración mejorada completada", this.currentConfig);
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Error de calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error durante la calibración");
      return false;
    }
  }

  resetToDefault(): void {
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    this.initialize();
    console.log("PPGSignalProcessor: Configuración restaurada a valores por defecto optimizados");
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      console.log("PPGSignalProcessor: No está procesando");
      return;
    }

    try {
      const redValue = this.extractRedChannel(imageData);
      const filtered = this.kalmanFilter.filter(redValue);
      this.lastValues.push(filtered);
      
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);

      if (this.lastValues.length % 30 === 0) {
        console.log("PPGSignalProcessor: Análisis periódico", {
          redValue: redValue.toFixed(2),
          filtered: filtered.toFixed(2),
          isFingerDetected,
          quality,
          stableFrames: this.stableFrameCount,
          bufferSize: this.lastValues.length
        });
      }

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue)
      };

      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    // Analyze a larger central area (33% central area)
    const startX = Math.floor(imageData.width * 0.33);
    const endX = Math.floor(imageData.width * 0.67);
    const startY = Math.floor(imageData.height * 0.33);
    const endY = Math.floor(imageData.height * 0.67);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];  // Red channel
        count++;
      }
    }
    
    const avgRed = redSum / count;
    return avgRed;
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    // More sensitive range check
    const isInRange = rawValue >= this.currentConfig.MIN_RED_THRESHOLD && 
                     rawValue <= this.currentConfig.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1); // Gradual reduction
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < this.currentConfig.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: Math.min(30, this.stableFrameCount * 5) };
    }

    // Enhanced stability detection for cardiac signals
    const recentValues = this.lastValues.slice(-this.currentConfig.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // More sensitive variation analysis
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Better peak detection
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    // More adaptive thresholds
    const adaptiveThreshold = Math.max(1.2, avgValue * 0.02); // Reduced for higher sensitivity
    
    // More forgiving stability check
    const isStable = maxVariation < adaptiveThreshold * 2.5 && 
                    minVariation > -adaptiveThreshold * 2.5;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.currentConfig.MIN_STABILITY_COUNT * 3);
      this.lastStableValue = filtered;
    } else {
      // Even more gradual reduction for stability
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.3);
    }

    // More sensitive finger detection
    const isFingerDetected = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      // Enhanced quality calculation with higher base
      const stabilityScore = Math.min(this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - this.currentConfig.MIN_RED_THRESHOLD) / 
                                    (this.currentConfig.MAX_RED_THRESHOLD - this.currentConfig.MIN_RED_THRESHOLD), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 4)));
      
      // Weighted calculation favoring stability
      quality = Math.round((stabilityScore * 0.5 + intensityScore * 0.3 + variationScore * 0.2) * 100);
      
      // Boost quality slightly for better UI experience
      quality = Math.min(100, quality * 1.1);
    }

    return { isFingerDetected, quality };
  }

  private detectROI(redValue: number): ProcessedSignal['roi'] {
    // Simple ROI calculation centered on the image
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
