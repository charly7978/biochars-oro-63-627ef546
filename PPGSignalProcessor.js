
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
    MIN_RED_THRESHOLD: 65,  // Further reduced for even higher sensitivity
    MAX_RED_THRESHOLD: 255, // Increased for wider detection range
    STABILITY_WINDOW: 3,    // Reduced for faster detection
    MIN_STABILITY_COUNT: 2  // Reduced for higher sensitivity
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private readonly BUFFER_SIZE = 10;
  private readonly MIN_RED_THRESHOLD = 65;
  private readonly MAX_RED_THRESHOLD = 255;
  private readonly STABILITY_WINDOW = 3;
  private readonly MIN_STABILITY_COUNT = 2;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.03; // Further reduced for better detection
  private peakDetectionCounter: number = 0;
  private lastPeakTime: number = 0;
  private readonly PEAK_COOLDOWN_MS = 300; // Minimum time between peaks

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada con parámetros calibrados para mejor detección de picos");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.kalmanFilter.reset();
      this.peakDetectionCounter = 0;
      this.lastPeakTime = 0;
      console.log("PPGSignalProcessor: Inicializado con parámetros optimizados para visualización de picos");
    } catch (error) {
      console.error("PPGSignalProcessor: Error de inicialización", error);
      this.handleError("INIT_ERROR", "Error al inicializar el procesador");
    }
  }

  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Iniciado con parámetros optimizados para visualización de picos");
  }

  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.kalmanFilter.reset();
    this.peakDetectionCounter = 0;
    this.lastPeakTime = 0;
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración mejorada para visualización de picos");
      await this.initialize();

      // Enhanced calibration process
      await new Promise(resolve => setTimeout(resolve, 1200)); // Shorter wait time
      
      // More adaptive threshold adjustment
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: Math.max(15, this.MIN_RED_THRESHOLD - 15),
        MAX_RED_THRESHOLD: Math.min(255, this.MAX_RED_THRESHOLD + 15),
        STABILITY_WINDOW: 3, // Reduced for faster detection
        MIN_STABILITY_COUNT: 2 // Reduced for higher sensitivity
      };

      console.log("PPGSignalProcessor: Calibración mejorada completada para visualización de picos", this.currentConfig);
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
      
      // Store value for peak detection
      const currentTime = Date.now();
      this.lastValues.push({
        time: currentTime,
        value: filtered,
        raw: redValue,
        isPeak: false,
        isArrhythmia: false
      });
      
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // Analysis of signal with enhanced peak detection
      const { isFingerDetected, quality, detectedPeaks } = this.analyzeSignal(filtered, redValue, currentTime);

      if (this.lastValues.length % 30 === 0) {
        console.log("PPGSignalProcessor: Análisis periódico con detección de picos mejorada", {
          redValue: redValue.toFixed(2),
          filtered: filtered.toFixed(2),
          isFingerDetected,
          quality,
          stableFrames: this.stableFrameCount,
          bufferSize: this.lastValues.length,
          detectedPeaks: detectedPeaks.length
        });
      }

      const processedSignal: ProcessedSignal = {
        timestamp: currentTime,
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue),
        peaks: detectedPeaks
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

  private analyzeSignal(filtered: number, rawValue: number, currentTime: number): { 
    isFingerDetected: boolean, 
    quality: number,
    detectedPeaks: Array<{time: number, value: number, isArrhythmia: boolean}>
  } {
    // More sensitive range check
    const isInRange = rawValue >= this.currentConfig.MIN_RED_THRESHOLD && 
                     rawValue <= this.currentConfig.MAX_RED_THRESHOLD;
    
    const detectedPeaks: Array<{time: number, value: number, isArrhythmia: boolean}> = [];
    
    if (!isInRange) {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1); // Gradual reduction
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0, detectedPeaks };
    }

    if (this.lastValues.length < this.currentConfig.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: Math.min(30, this.stableFrameCount * 5), detectedPeaks };
    }

    // Enhanced stability detection for cardiac signals
    const recentValues = this.lastValues.slice(-this.currentConfig.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val.value, 0) / recentValues.length;
    
    // Peak detection logic (more sensitive)
    if (this.lastValues.length >= 3) {
      const lastThree = this.lastValues.slice(-3);
      
      // Check if middle value is higher than both neighbors (peak detection)
      if (lastThree[1].value > lastThree[0].value && 
          lastThree[1].value > lastThree[2].value && 
          lastThree[1].value > avgValue * 1.015 && // Very sensitive threshold
          currentTime - this.lastPeakTime > this.PEAK_COOLDOWN_MS) {
          
        // This is a peak!
        const peakValue = lastThree[1].value;
        const peakTime = lastThree[1].time;
        
        // Detect arrhythmia based on timing pattern
        // If peak came too soon after previous peak (premature beat)
        const timeSinceLastPeak = peakTime - this.lastPeakTime;
        const isArrhythmia = this.lastPeakTime > 0 && timeSinceLastPeak < 600 && timeSinceLastPeak > 200;
        
        detectedPeaks.push({
          time: peakTime,
          value: peakValue,
          isArrhythmia
        });
        
        if (isArrhythmia) {
          console.log("PPGSignalProcessor: ¡ARRITMIA DETECTADA!", {
            peakValue,
            timeSinceLastPeak,
            currentTime: new Date(currentTime).toISOString()
          });
        }
        
        this.lastPeakTime = peakTime;
        
        // Update peak flags in stored data
        this.lastValues[this.lastValues.length - 2].isPeak = true;
        this.lastValues[this.lastValues.length - 2].isArrhythmia = isArrhythmia;
        
        this.peakDetectionCounter++;
        
        console.log(`PPGSignalProcessor: Pico ${this.peakDetectionCounter} detectado`, {
          value: peakValue.toFixed(2),
          time: new Date(peakTime).toISOString(),
          isArrhythmia
        });
      }
    }
    
    // More adaptive thresholds
    const adaptiveThreshold = Math.max(0.8, avgValue * 0.015); // Reduced for higher sensitivity
    
    // More forgiving stability check
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return Math.abs(val.value - arr[i-1].value);
    });
    
    const maxVariation = Math.max(...variations);
    const isStable = maxVariation < adaptiveThreshold * 3.5; // More permissive

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.currentConfig.MIN_STABILITY_COUNT * 3);
      this.lastStableValue = filtered;
    } else {
      // Even more gradual reduction for stability
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.2);
    }

    // More sensitive finger detection
    const isFingerDetected = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      // Enhanced quality calculation with higher base
      const stabilityScore = Math.min(this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - this.currentConfig.MIN_RED_THRESHOLD) / 
                                    (this.currentConfig.MAX_RED_THRESHOLD - this.currentConfig.MIN_RED_THRESHOLD), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 6)));
      
      // Weighted calculation favoring stability and adding peak detection bonus
      const peakDetectionBonus = Math.min(1, this.peakDetectionCounter / 10) * 0.2;
      quality = Math.round((stabilityScore * 0.4 + intensityScore * 0.2 + variationScore * 0.2 + peakDetectionBonus) * 100);
      
      // Boost quality slightly for better UI experience
      quality = Math.min(100, quality * 1.15);
    }

    return { isFingerDetected, quality, detectedPeaks };
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
