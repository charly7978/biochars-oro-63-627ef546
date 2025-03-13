
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
    MIN_RED_THRESHOLD: 85,     // Increased for better detection
    MAX_RED_THRESHOLD: 255,
    STABILITY_WINDOW: 6,
    MIN_STABILITY_COUNT: 3,
    HYSTERESIS: 5,
    MIN_CONSECUTIVE_DETECTIONS: 2
  };

  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private readonly DETECTION_TIMEOUT = 500; // 500ms timeout
  
  // Debug information
  private lastDebugLog: number = 0;
  private readonly DEBUG_INTERVAL = 1000; // Log debug info every second

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada con nueva lógica de detección");
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
      console.log("PPGSignalProcessor: Inicializado con configuración:", this.currentConfig);
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
      
      // Configuración más sensible para la detección de dedos
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: 80,  // Más permisivo
        MIN_STABILITY_COUNT: 2, // Respuesta más rápida
      };
      
      console.log("PPGSignalProcessor: Calibración completada con nueva configuración:", this.currentConfig);
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
      // Extract and process the red channel
      const extractionResult = this.extractRedChannel(imageData);
      const redValue = extractionResult.redValue;
      
      // Log debug info periodically
      const now = Date.now();
      if (now - this.lastDebugLog > this.DEBUG_INTERVAL) {
        console.log("PPGSignalProcessor: Datos de extracción:", {
          redValue: redValue.toFixed(2),
          redGreenRatio: extractionResult.redGreenRatio.toFixed(2),
          brightness: extractionResult.brightness.toFixed(2),
          isRedDominant: extractionResult.isRedDominant,
          threshold: this.currentConfig.MIN_RED_THRESHOLD,
          time: new Date().toISOString()
        });
        this.lastDebugLog = now;
      }
      
      // Apply Kalman filter to smooth the signal
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Analyze signal to determine finger presence and quality
      const analysisResult = this.analyzeSignal(filtered, redValue);
      
      // Create processed signal object
      const processedSignal: ProcessedSignal = {
        timestamp: now,
        rawValue: redValue,
        filteredValue: filtered,
        quality: analysisResult.quality,
        fingerDetected: analysisResult.isFingerDetected,
        roi: this.detectROI(redValue),
        perfusionIndex: redValue > 0 ? 
          Math.abs(filtered - this.lastStableValue) / Math.max(1, redValue) : 0
      };
      
      // Provide feedback on signal quality
      if (analysisResult.isFingerDetected && analysisResult.quality < 40 && this.onError) {
        this.onError({
          code: "LOW_QUALITY",
          message: "Señal débil. Asegúrese de que el dedo cubra completamente la cámara.",
          timestamp: now
        });
      }
      
      // Send the processed signal
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
      
      // Update last stable value
      if (analysisResult.isFingerDetected) {
        this.lastStableValue = filtered;
      }

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private extractRedChannel(imageData: ImageData): { 
    redValue: number, 
    isRedDominant: boolean,
    redGreenRatio: number,
    brightness: number
  } {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    // Central ROI for better precision (40% of center)
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    const roiSize = Math.min(imageData.width, imageData.height) * 0.4;
    
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
    
    // Calculate overall brightness
    const brightness = (avgRed + avgGreen + avgBlue) / 3;
    
    // For finger detection: red should be significantly higher than green when finger is present
    const redGreenRatio = avgGreen > 0 ? avgRed / avgGreen : 1;
    const isRedDominant = redGreenRatio > 1.2 && avgRed > this.currentConfig.MIN_RED_THRESHOLD;
    
    return {
      redValue: isRedDominant ? avgRed : 0,
      isRedDominant,
      redGreenRatio,
      brightness
    };
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const currentTime = Date.now();
    
    // If no red dominance detected (redValue = 0), definitely no finger
    if (rawValue <= 0) {
      this.consecutiveDetections = 0;
      this.stableFrameCount = 0;
      this.isCurrentlyDetected = false;
      return { isFingerDetected: false, quality: 0 };
    }
    
    // Add value to history for stability analysis
    this.lastValues.push(filtered);
    if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
      this.lastValues.shift();
    }
    
    // Calculate signal stability
    const stability = this.calculateStability();
    
    // Update stability counters
    if (stability > 0.7) {
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > 0.5) {
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 0.5,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }
    
    // Determine if signal is stable enough
    const isStableNow = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;
    
    // Update consecutive detections counter
    if (isStableNow) {
      this.consecutiveDetections++;
      if (this.consecutiveDetections >= this.currentConfig.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
      }
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.5);
      
      // Only cancel detection after a timeout
      if (currentTime - this.lastDetectionTime > this.DETECTION_TIMEOUT && 
          this.consecutiveDetections < 1) {
        this.isCurrentlyDetected = false;
      }
    }
    
    // Calculate signal quality
    let quality = 0;
    if (this.isCurrentlyDetected) {
      // Quality components
      const stabilityScore = Math.min(1, this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2));
      
      // Score by intensity - optimized for real finger detection
      const optimalValue = (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.MIN_RED_THRESHOLD) / 2;
      const distanceFromOptimal = Math.abs(rawValue - optimalValue) / optimalValue;
      const intensityScore = Math.max(0, 1 - distanceFromOptimal);
      
      // Calculate variability score
      let variabilityScore = 0;
      if (this.lastValues.length >= 5) {
        const recentValues = this.lastValues.slice(-5);
        const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
        const diffs = recentValues.map(v => Math.abs(v - avg));
        const avgDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
        
        // Some variability is good (heartbeat), but not too much
        variabilityScore = avgDiff > 0.3 && avgDiff < 3 ? 1 : 
                           avgDiff < 0.1 ? 0.3 : 
                           avgDiff > 6 ? 0.2 : 
                           0.5;
      }
      
      // Combine scores with different weights
      const rawQuality = stabilityScore * 0.5 + intensityScore * 0.3 + variabilityScore * 0.2;
      quality = Math.round(rawQuality * 100);
    }
    
    return {
      isFingerDetected: this.isCurrentlyDetected,
      quality
    };
  }

  private calculateStability(): number {
    if (this.lastValues.length < 3) return 0;
    
    // Calculate variation between consecutive values
    const variations = [];
    for (let i = 1; i < this.lastValues.length; i++) {
      variations.push(Math.abs(this.lastValues[i] - this.lastValues[i-1]));
    }
    
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
    const normalizedStability = Math.max(0, Math.min(1, 1 - (avgVariation / 5)));
    
    return normalizedStability;
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
