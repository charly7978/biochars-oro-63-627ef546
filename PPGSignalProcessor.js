
import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';
import { SignalAmplifier } from '../modules/SignalAmplifier';

class KalmanFilter {
  private R: number = 0.008; // Noise reduction factor
  private Q: number = 0.12;  // Process noise
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
    BUFFER_SIZE: 12,
    MIN_RED_THRESHOLD: 95,  // Increased threshold for stricter finger detection
    MAX_RED_THRESHOLD: 245,
    STABILITY_WINDOW: 6,    // Increased to require more stability
    MIN_STABILITY_COUNT: 4  // Increased to require more stability
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private readonly BUFFER_SIZE = 12;
  private readonly MIN_RED_THRESHOLD = 95; // Increased for stricter detection
  private readonly MAX_RED_THRESHOLD = 245;
  private readonly STABILITY_WINDOW = 6;   // Increased
  private readonly MIN_STABILITY_COUNT = 4; // Increased
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.08; // Increased threshold

  // Variables for dynamic threshold adaptation
  private dynamicThreshold: number = 0;
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 25; // Increased for better analysis
  private readonly ADAPTATION_RATE = 0.10; // Decreased for more stability
  
  // Signal amplifier for additional improvements
  private signalAmplifier: SignalAmplifier;
  private lastAmplifiedValue: number = 0;
  private signalQuality: number = 0;
  
  // Variables for improved finger detection
  private consecutiveWeakSignals: number = 0;
  private readonly MAX_WEAK_SIGNALS = 2; // More sensitive to weak signals
  private readonly WEAK_SIGNAL_THRESHOLD = 0.18; // Higher threshold
  
  // False positive prevention
  private baselineValues: number[] = [];
  private readonly BASELINE_SIZE = 12; // Increased
  private hasEstablishedBaseline: boolean = false;
  
  // Artificially stable signal detection (likely no finger)
  private stabilityCounter: number = 0;
  private readonly MAX_STABLE_FRAMES = 20;
  private isArtificiallyStable: boolean = false;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    this.signalAmplifier = new SignalAmplifier();
    console.log("PPGSignalProcessor: Instancia creada con amplificador de señal integrado");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.kalmanFilter.reset();
      this.signalHistory = [];
      this.dynamicThreshold = 0;
      this.signalAmplifier.reset();
      this.lastAmplifiedValue = 0;
      this.signalQuality = 0;
      this.consecutiveWeakSignals = 0;
      this.baselineValues = [];
      this.hasEstablishedBaseline = false;
      this.stabilityCounter = 0;
      this.isArtificiallyStable = false;
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
    this.kalmanFilter.reset();
    this.signalHistory = [];
    this.dynamicThreshold = 0;
    this.signalAmplifier.reset();
    this.lastAmplifiedValue = 0;
    this.signalQuality = 0;
    this.consecutiveWeakSignals = 0;
    this.baselineValues = [];
    this.hasEstablishedBaseline = false;
    this.stabilityCounter = 0;
    this.isArtificiallyStable = false;
    console.log("PPGSignalProcessor: Detenido");
  }

  resetToDefault(): void {
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    this.initialize();
    console.log("PPGSignalProcessor: Configuración restaurada a valores por defecto");
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      console.log("PPGSignalProcessor: No está procesando");
      return;
    }

    try {
      const redValue = this.extractRedChannel(imageData);
      
      // Check if signal is too stable (artificial) - common when no finger is present
      if (this.lastValues.length > 5) {
        const recentValues = this.lastValues.slice(-5);
        const minRecent = Math.min(...recentValues);
        const maxRecent = Math.max(...recentValues);
        const rangeRecent = maxRecent - minRecent;
        
        // If range is extremely small for several frames in a row, likely no finger
        if (rangeRecent < 0.05) {
          this.stabilityCounter++;
        } else {
          this.stabilityCounter = Math.max(0, this.stabilityCounter - 1);
        }
        
        this.isArtificiallyStable = this.stabilityCounter > this.MAX_STABLE_FRAMES;
        
        if (this.isArtificiallyStable) {
          console.log("PPGSignalProcessor: Señal artificialmente estable detectada - posible ausencia de dedo", {
            rangeRecent,
            stabilityCounter: this.stabilityCounter,
            recentValues
          });
          
          // Force quality to 0 and no finger detected
          if (this.onSignalReady) {
            this.onSignalReady({
              timestamp: Date.now(),
              rawValue: redValue,
              filteredValue: 0,
              quality: 0,
              fingerDetected: false,
              roi: this.detectROI(redValue),
              perfusionIndex: 0
            });
          }
          return;
        }
      }
      
      // Establish baseline for better false positive rejection
      if (!this.hasEstablishedBaseline) {
        this.baselineValues.push(redValue);
        if (this.baselineValues.length > this.BASELINE_SIZE) {
          this.baselineValues.shift();
          this.hasEstablishedBaseline = true;
          
          // Calculate baseline stats
          const baselineAvg = this.baselineValues.reduce((sum, val) => sum + val, 0) / this.baselineValues.length;
          const baselineVar = this.baselineValues.reduce((sum, val) => sum + Math.pow(val - baselineAvg, 2), 0) / this.baselineValues.length;
          console.log("PPGSignalProcessor: Baseline established", { baselineAvg, baselineVar });
        }
        
        // Return early with not-detected status during baseline collection
        if (!this.hasEstablishedBaseline) {
          if (this.onSignalReady) {
            this.onSignalReady({
              timestamp: Date.now(),
              rawValue: redValue,
              filteredValue: 0,
              quality: 0,
              fingerDetected: false,
              roi: this.detectROI(redValue),
              perfusionIndex: 0
            });
          }
          return;
        }
      }
      
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Apply advanced signal amplifier
      const { amplifiedValue, quality } = this.signalAmplifier.processValue(filtered);
      this.lastAmplifiedValue = amplifiedValue;
      this.signalQuality = quality;
      
      // Save amplified value in buffer
      this.lastValues.push(amplifiedValue);
      
      // Update history for dynamic adaptation
      this.signalHistory.push(amplifiedValue);
      if (this.signalHistory.length > this.HISTORY_SIZE) {
        this.signalHistory.shift();
      }
      
      // Update dynamic threshold if we have enough data
      if (this.signalHistory.length >= this.HISTORY_SIZE / 2) {
        this.updateDynamicThreshold();
      }
      
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // Analysis with amplified value and strict finger detection
      const { isFingerDetected, quality: detectionQuality } = this.analyzeSignal(amplifiedValue, redValue);
      
      // Check for weak signal to detect finger removal or poor placement
      const isWeakSignal = Math.abs(amplifiedValue) < this.WEAK_SIGNAL_THRESHOLD;
      
      if (isWeakSignal) {
        this.consecutiveWeakSignals++;
      } else {
        this.consecutiveWeakSignals = Math.max(0, this.consecutiveWeakSignals - 1);
      }
      
      // Add additional verification to prevent false positives
      const suspiciouslyStableSignal = this.detectSuspiciouslyStableSignal();
      
      // Override finger detection if we have too many weak signals or signal is suspiciously stable
      const finalFingerDetected = isFingerDetected && 
                               (this.consecutiveWeakSignals < this.MAX_WEAK_SIGNALS) &&
                               !suspiciouslyStableSignal;
      
      // Use amplifier quality for better detection
      const perfusionIndex = this.calculatePerfusionIndex();
      const combinedQuality = finalFingerDetected ? 
        Math.round((detectionQuality * 0.7 + this.signalQuality * 100 * 0.3)) : 0;

      console.log("PPGSignalProcessor: Enhanced analysis with stricter validation", {
        redValue,
        filtered,
        amplifiedValue,
        isFingerDetected: finalFingerDetected,
        detectionQuality,
        amplifierQuality: this.signalQuality,
        combinedQuality,
        stableFrames: this.stableFrameCount,
        perfusionIndex,
        dynamicThreshold: this.dynamicThreshold,
        amplifierGain: this.signalAmplifier.getCurrentGain(),
        weakSignalCount: this.consecutiveWeakSignals,
        isWeakSignal,
        suspiciouslyStableSignal
      });

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: amplifiedValue,
        quality: combinedQuality,
        fingerDetected: finalFingerDetected,
        roi: this.detectROI(redValue),
        perfusionIndex
      };

      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private detectSuspiciouslyStableSignal(): boolean {
    if (this.lastValues.length < 10) return false;
    
    const recentValues = this.lastValues.slice(-10);
    const minValue = Math.min(...recentValues);
    const maxValue = Math.max(...recentValues);
    const range = maxValue - minValue;
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calculate normalized deviation from the mean
    const normalizedDeviations = recentValues.map(v => Math.abs(v - mean) / Math.max(0.01, mean));
    const avgDeviation = normalizedDeviations.reduce((sum, val) => sum + val, 0) / normalizedDeviations.length;
    
    const isTooStable = range < 0.08 && avgDeviation < 0.03;
    
    if (isTooStable) {
      console.log("PPGSignalProcessor: Suspiciously stable signal detected", {
        range,
        avgDeviation,
        recentValues
      });
    }
    
    return isTooStable;
  }

  private updateDynamicThreshold(): void {
    const min = Math.min(...this.signalHistory);
    const max = Math.max(...this.signalHistory);
    const range = max - min;
    
    // Calculate new threshold based on signal range
    const newThreshold = range * 0.35; // 35% of range as threshold (increased)
    
    // Update dynamically with smoothing
    if (this.dynamicThreshold === 0) {
      this.dynamicThreshold = newThreshold;
    } else {
      this.dynamicThreshold = (1 - this.ADAPTATION_RATE) * this.dynamicThreshold + 
                             this.ADAPTATION_RATE * newThreshold;
    }
  }

  private calculatePerfusionIndex(): number {
    if (this.lastValues.length < 5) return 0;
    
    const recent = this.lastValues.slice(-5);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    
    // PI = (AC/DC)
    const ac = max - min;
    const dc = (max + min) / 2;
    
    return dc > 0 ? ac / dc : 0;
  }

  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    // Only analyze the center of the image (25% central - smaller area for more precision)
    const startX = Math.floor(imageData.width * 0.375);
    const endX = Math.floor(imageData.width * 0.625);
    const startY = Math.floor(imageData.height * 0.375);
    const endY = Math.floor(imageData.height * 0.625);
    
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
    // Use dynamic threshold for better adaptation with a higher minimum threshold
    const effectiveThreshold = Math.max(
      this.MIN_RED_THRESHOLD,
      this.dynamicThreshold > 0 ? this.dynamicThreshold : this.MIN_RED_THRESHOLD
    );
                              
    // Check if the value is in range - stricter range requirements
    const isInRange = rawValue >= effectiveThreshold && rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < this.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Enhanced analysis with amplified signal
    const recentValues = this.lastValues.slice(-this.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Enhanced variation analysis to detect peaks
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Use amplifier quality to adjust thresholds
    const qualityFactor = 0.8 + (this.signalQuality * 0.3); // 0.8-1.1 adjusted range
    
    // More sensitive detection of cardiac peaks
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    // Check if the signal has TOO little variation (may be artificial/no finger)
    const hasTooLittleVariation = maxVariation < 0.03 && variations.every(v => Math.abs(v) < 0.05);
    if (hasTooLittleVariation) {
      console.log("PPGSignalProcessor: Signal has suspiciously little variation", {
        variations,
        maxVariation
      });
      return { isFingerDetected: false, quality: 0 };
    }
    
    // Adaptive thresholds with amplifier influence - more strict
    const adaptiveThreshold = Math.max(2.0, avgValue * 0.025 * qualityFactor);
    const isStable = maxVariation < adaptiveThreshold * 1.8 && 
                    minVariation > -adaptiveThreshold * 1.8 &&
                    !hasTooLittleVariation;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      // More aggressive reduction for unstable signals
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1);
    }

    // Benefit from amplifier quality for detection
    // Require both stable frames AND good quality signal - stricter requirements
    const isFingerDetected = 
      (this.stableFrameCount >= this.MIN_STABILITY_COUNT) && 
      (this.signalQuality > 0.6); // Increased quality requirement
    
    let quality = 0;
    if (isFingerDetected) {
      // Improved quality calculation with amplifier and stricter criteria
      const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - effectiveThreshold) / 
                                    (this.MAX_RED_THRESHOLD - effectiveThreshold), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 3)));
      const amplifierScore = this.signalQuality;
      
      // If variation is extremely low, penalize the quality score
      const variationPenalty = maxVariation < 0.05 ? 0.3 : 1.0;
      
      // Weighted quality calculation with more weight to stability
      quality = Math.round((
        stabilityScore * 0.35 + 
        intensityScore * 0.25 + 
        variationScore * 0.15 + 
        amplifierScore * 0.25
      ) * 100 * variationPenalty);
    }

    return { isFingerDetected, quality };
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
