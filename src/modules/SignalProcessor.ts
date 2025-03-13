
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
  // Enhanced configuration with more sensitive defaults
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 60,     // Lowered threshold for better finger detection
    MAX_RED_THRESHOLD: 255,
    STABILITY_WINDOW: 4,       // Smaller window for faster response
    MIN_STABILITY_COUNT: 2,    // Reduced for more sensitivity 
    HYSTERESIS: 5,
    MIN_CONSECUTIVE_DETECTIONS: 2
  };

  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private readonly DETECTION_TIMEOUT = 500; // Reduced for faster response
  private isAndroid: boolean = false;
  private lastRedValue: number = 0;
  
  // Debug information
  private lastDebugLog: number = 0;
  private readonly DEBUG_INTERVAL = 1000; // Log debug info every second

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.isAndroid = /android/i.test(navigator.userAgent);
    
    // Optimized configuration for different platforms
    if (this.isAndroid) {
      this.currentConfig = { 
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: 50,  // Much lower threshold for Android
        BUFFER_SIZE: 10,        // Smaller buffer for faster processing
        STABILITY_WINDOW: 3,    // Smaller window
        MIN_STABILITY_COUNT: 1  // More responsive
      };
    } else {
      this.currentConfig = { 
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: 60  // Lower threshold for all platforms
      };
    }
    
    console.log("PPGSignalProcessor: Instancia creada con configuración específica para plataforma", {
      isAndroid: this.isAndroid,
      config: this.currentConfig
    });
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.consecutiveDetections = 0;
      this.isCurrentlyDetected = false;
      this.lastDetectionTime = 0;
      this.lastRedValue = 0;
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
    this.lastRedValue = 0;
    this.kalmanFilter.reset();
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración");
      await this.initialize();
      
      // Platform-specific optimization
      if (this.isAndroid) {
        this.currentConfig = {
          ...this.DEFAULT_CONFIG,
          MIN_RED_THRESHOLD: 40,  // Very permissive threshold for Android
          MIN_STABILITY_COUNT: 1,  // Faster response
          STABILITY_WINDOW: 3      // Smaller window
        };
      } else {
        // For desktop and iOS
        this.currentConfig = {
          ...this.DEFAULT_CONFIG,
          MIN_RED_THRESHOLD: 60,   // More permissive than original
          MIN_STABILITY_COUNT: 2,  // Faster response
          STABILITY_WINDOW: 4      // Smaller window
        };
      }
      
      console.log("PPGSignalProcessor: Calibración completada con configuración:", this.currentConfig);
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
      // Enhanced red channel extraction with precise ROI targeting
      const extractionResult = this.extractRedChannel(imageData);
      const redValue = extractionResult.redValue;
      this.lastRedValue = redValue;
      
      // Log debug info periodically
      const now = Date.now();
      if (now - this.lastDebugLog > this.DEBUG_INTERVAL) {
        console.log("PPGSignalProcessor: Datos de extracción:", {
          redValue: redValue.toFixed(2),
          redGreenRatio: extractionResult.redGreenRatio.toFixed(2),
          brightness: extractionResult.brightness.toFixed(2),
          isRedDominant: extractionResult.isRedDominant,
          threshold: this.currentConfig.MIN_RED_THRESHOLD,
          isAndroid: this.isAndroid,
          time: new Date().toISOString()
        });
        this.lastDebugLog = now;
      }
      
      // Apply Kalman filter for noise reduction
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Add to history buffer
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
        this.lastValues.shift();
      }
      
      // Enhanced signal analysis for finger detection and quality assessment
      const analysisResult = this.analyzeSignal(filtered, redValue);
      
      // Create processed signal object with high-precision timestamp
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
      
      // Send processed signal
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
      
      // Update stable value reference
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
    
    // Optimized ROI size - larger area for better coverage
    const roiSize = this.isAndroid ? 
                    Math.min(imageData.width, imageData.height) * 0.6 :
                    Math.min(imageData.width, imageData.height) * 0.5;
    
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    
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
    
    // Enhanced finger detection logic: red should be significantly higher than green
    // Lower threshold for all platforms
    const redGreenThreshold = this.isAndroid ? 1.05 : 1.10;
    const redGreenRatio = avgGreen > 0 ? avgRed / avgGreen : 1;
    
    // More sensitive red dominance check
    const isRedDominant = (redGreenRatio > redGreenThreshold && 
                          avgRed > this.currentConfig.MIN_RED_THRESHOLD) ||
                          // Alternative detection for very red scenes
                          (avgRed > this.currentConfig.MIN_RED_THRESHOLD * 1.5 && 
                           avgRed > avgGreen * 1.02);
    
    return {
      redValue: isRedDominant ? avgRed : 0,
      isRedDominant,
      redGreenRatio,
      brightness
    };
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const currentTime = Date.now();
    
    // No red dominance detected (redValue = 0) means definitely no finger
    if (rawValue <= 0) {
      this.consecutiveDetections = 0;
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
      
      // Only clear detection after timeout to prevent flickering
      if (currentTime - this.lastDetectionTime > this.DETECTION_TIMEOUT) {
        this.isCurrentlyDetected = false;
      }
      
      return { isFingerDetected: this.isCurrentlyDetected, quality: 0 };
    }
    
    // Calculate signal stability
    const stability = this.calculateStability();
    
    // Adaptive stability thresholds based on platform and signal history
    const stableThreshold = this.isAndroid ? 0.4 : 0.6;
    const mediumStableThreshold = this.isAndroid ? 0.2 : 0.4;
    
    // Update stability counters with smoother transitions
    if (stability > stableThreshold) {
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > mediumStableThreshold) {
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 0.5,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else {
      // Slower decay for stability counter
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.3);
    }
    
    // Determine if signal is stable enough
    const isStableNow = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;
    
    // Update consecutive detection counter
    if (isStableNow) {
      this.consecutiveDetections++;
      if (this.consecutiveDetections >= this.currentConfig.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
      }
    } else {
      // Slower decay for consecutive detections
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.3);
      
      // Only cancel detection after timeout and significant degradation
      if (currentTime - this.lastDetectionTime > this.DETECTION_TIMEOUT && 
          this.consecutiveDetections < 0.5) {
        this.isCurrentlyDetected = false;
      }
    }
    
    // Enhanced quality calculation
    let quality = 0;
    if (this.isCurrentlyDetected) {
      // Quality components with optimized weights
      const stabilityScore = Math.min(1, this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2));
      
      // Intensity score - optimized for real finger detection
      const optimalValue = (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.MIN_RED_THRESHOLD) / 2;
      const distanceFromOptimal = Math.abs(rawValue - optimalValue) / optimalValue;
      const intensityScore = Math.max(0, 1 - distanceFromOptimal);
      
      // Calculate variability score - some variability is good (heartbeat)
      let variabilityScore = 0;
      if (this.lastValues.length >= 5) {
        const recentValues = this.lastValues.slice(-5);
        const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
        const diffs = recentValues.map(v => Math.abs(v - avg));
        const avgDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
        
        // Some variability is good (heartbeat), but not too much
        variabilityScore = avgDiff > 0.2 && avgDiff < 4 ? 1 : 
                          avgDiff < 0.1 ? 0.3 : 
                          avgDiff > 8 ? 0.1 : 
                          0.5;
      }
      
      // Combine scores with platform-specific weights
      const rawQuality = this.isAndroid ?
                         (stabilityScore * 0.5 + intensityScore * 0.4 + variabilityScore * 0.1) :
                         (stabilityScore * 0.4 + intensityScore * 0.4 + variabilityScore * 0.2);
      
      // Apply smoother scaling and convert to percentage
      quality = Math.round(rawQuality * 100);
      
      // Boost quality slightly for better UI experience
      quality = Math.min(100, quality * 1.15);
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
    
    // Adaptive threshold based on signal average
    const avgSignal = this.lastValues.reduce((sum, val) => sum + val, 0) / this.lastValues.length;
    const relativeVariation = avgSignal > 0 ? avgVariation / avgSignal : 1;
    
    // Platform-specific thresholds
    const threshold = this.isAndroid ? 
                     0.08 : // 8% variation acceptable for Android
                     0.06;  // 6% variation acceptable for other platforms
    
    // Normalize to 0-1 range with smoother transitions
    const normalizedStability = Math.max(0, Math.min(1, 1 - (relativeVariation / threshold)));
    
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
