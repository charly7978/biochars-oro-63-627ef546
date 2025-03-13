
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
    MIN_RED_THRESHOLD: 65,     // Reduced threshold for better detection
    MAX_RED_THRESHOLD: 250,
    STABILITY_WINDOW: 6,
    MIN_STABILITY_COUNT: 4,    // Reduced for faster response
    HYSTERESIS: 5,
    MIN_CONSECUTIVE_DETECTIONS: 2  // Reduced for faster response
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
      // Extract and process the red channel (most important for PPG)
      const extractionResult = this.extractRedChannel(imageData);
      const redValue = extractionResult.redValue;
      
      console.log("PPGSignalProcessor: Extracción de canal rojo:", {
        redValue,
        pixelCount: extractionResult.pixelCount,
        avgRed: extractionResult.avgRed,
        avgGreen: extractionResult.avgGreen,
        avgBlue: extractionResult.avgBlue,
        redDominance: (extractionResult.avgRed / Math.max(1, extractionResult.avgGreen)).toFixed(2),
        threshold: this.currentConfig.MIN_RED_THRESHOLD
      });
      
      // Apply Kalman filter to smooth the signal and reduce noise
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Advanced signal analysis to determine finger presence and quality
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);
      
      console.log("PPGSignalProcessor: Análisis de señal:", { 
        redValue, 
        filtered, 
        isFingerDetected,
        quality,
        stableFrames: this.stableFrameCount,
        consecutiveDetections: this.consecutiveDetections,
        timestamp: new Date().toISOString()
      });
      
      // Calculate ROI coordinates
      const roi = this.detectROI(redValue);
      
      // Additional metrics for debugging and analysis
      const perfusionIndex = redValue > 0 ? 
        Math.abs(filtered - this.lastStableValue) / Math.max(1, redValue) : 0;
      
      // Create processed signal object with all relevant data
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: roi,
        perfusionIndex: perfusionIndex
      };
      
      // Provide feedback on torch usage when needed
      if (isFingerDetected && quality < 40 && redValue < 100 && this.onError) {
        // Signal detected but weak - might indicate poor lighting
        this.onError({
          code: "LOW_LIGHT",
          message: "Señal débil. Por favor asegúrese de que la linterna esté encendida y el dedo cubra completamente la cámara.",
          timestamp: Date.now()
        });
      }
      
      // Warn if there's overexposure (saturation) affecting quality
      if (isFingerDetected && redValue > 240 && this.onError) {
        this.onError({
          code: "OVEREXPOSED",
          message: "La imagen está sobreexpuesta. Intente ajustar la posición del dedo para reducir el brillo.",
          timestamp: Date.now()
        });
      }
      
      // Send the processed signal to the callback
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
      
      // Store the last processed value for future calculations
      this.lastStableValue = isFingerDetected ? filtered : this.lastStableValue;

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private extractRedChannel(imageData: ImageData): { 
    redValue: number, 
    pixelCount: number,
    avgRed: number,
    avgGreen: number,
    avgBlue: number
  } {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    // Central ROI for better precision
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * 0.4; // 40% of smaller dimension
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
    // Process all pixels in the ROI
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        const r = data[i];     // Red channel
        const g = data[i+1];   // Green channel
        const b = data[i+2];   // Blue channel
        
        redSum += r;
        greenSum += g;
        blueSum += b;
        pixelCount++;
      }
    }
    
    // Calculate averages
    const avgRed = pixelCount > 0 ? redSum / pixelCount : 0;
    const avgGreen = pixelCount > 0 ? greenSum / pixelCount : 0;
    const avgBlue = pixelCount > 0 ? blueSum / pixelCount : 0;
    
    // FIXED LOGIC: When a finger is present, red channel should be significantly higher
    const isRedDominant = avgRed > (avgGreen * 1.1) && avgRed > (avgBlue * 1.1);
    const isInRange = avgRed > this.currentConfig.MIN_RED_THRESHOLD && avgRed < this.currentConfig.MAX_RED_THRESHOLD;
    const isFingerLikely = isRedDominant && isInRange;
    
    // Return the redValue and additional data for debugging
    return {
      redValue: isFingerLikely ? avgRed : 0,
      pixelCount,
      avgRed,
      avgGreen,
      avgBlue
    };
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const currentTime = Date.now();
    const timeSinceLastDetection = currentTime - this.lastDetectionTime;
    
    // If raw value is 0 (no red dominance detected), definitely no finger
    if (rawValue <= 0) {
      this.consecutiveDetections = 0;
      this.stableFrameCount = 0;
      this.isCurrentlyDetected = false;
      console.log("PPGSignalProcessor: No se detecta dedo (rawValue <= 0)");
      return { isFingerDetected: false, quality: 0 };
    }
    
    // Check if value is within valid range with hysteresis
    const inRange = rawValue >= this.currentConfig.MIN_RED_THRESHOLD && 
                   rawValue <= this.currentConfig.MAX_RED_THRESHOLD;

    if (!inRange) {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1);
      
      // Only cancel detection after a timeout to avoid false negatives
      if (timeSinceLastDetection > this.DETECTION_TIMEOUT && this.consecutiveDetections === 0) {
        this.isCurrentlyDetected = false;
      }
      
      console.log("PPGSignalProcessor: Valor fuera de rango:", {
        rawValue,
        minThreshold: this.currentConfig.MIN_RED_THRESHOLD,
        maxThreshold: this.currentConfig.MAX_RED_THRESHOLD
      });
      
      return { isFingerDetected: this.isCurrentlyDetected, quality: this.isCurrentlyDetected ? 10 : 0 };
    }

    // Calculate temporal stability of the signal
    const stability = this.calculateStability();
    
    // Add value to history for analysis
    this.lastValues.push(filtered);
    if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
      this.lastValues.shift();
    }
    
    // Update stability counters based on signal quality
    if (stability > 0.8) {
      // Very stable signal, increment quickly
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1.5,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.6) {
      // Moderately stable signal
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.4) {
      // Medium stability signal
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 0.5,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else {
      // Unstable signal
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    // Update detection state
    const isStableNow = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;

    if (isStableNow) {
      this.consecutiveDetections++;
      if (this.consecutiveDetections >= this.currentConfig.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
        this.lastStableValue = filtered;
      }
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.5);
    }

    // Calculate signal quality
    const stabilityScore = Math.min(1, this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2));
    
    // Score by intensity - optimized for real finger detection
    const optimalValue = (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.MIN_RED_THRESHOLD) / 2;
    const distanceFromOptimal = Math.abs(rawValue - optimalValue) / optimalValue;
    const intensityScore = Math.max(0, 1 - distanceFromOptimal);
    
    // Score by variability
    let variabilityScore = 0;
    if (this.lastValues.length >= 5) {
      const variations = [];
      for (let i = 1; i < this.lastValues.length; i++) {
        variations.push(Math.abs(this.lastValues[i] - this.lastValues[i-1]));
      }
      
      const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
      variabilityScore = avgVariation > 0.5 && avgVariation < 4 ? 1 : 
                         avgVariation < 0.2 ? 0 : 
                         avgVariation > 10 ? 0 : 
                         0.5;
    }
    
    // Combine scores with different weights
    const qualityRaw = stabilityScore * 0.5 + intensityScore * 0.3 + variabilityScore * 0.2;
    
    // Scale to 0-100 and round
    const quality = Math.round(qualityRaw * 100);
    
    console.log("PPGSignalProcessor: Análisis completo:", {
      isStable: isStableNow,
      stableFrameCount: this.stableFrameCount,
      consecutiveDetections: this.consecutiveDetections,
      isFingerDetected: this.isCurrentlyDetected,
      quality,
      stability,
      stabilityScore,
      intensityScore,
      variabilityScore
    });
    
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
