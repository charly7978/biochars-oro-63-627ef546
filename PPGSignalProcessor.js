
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
    MIN_RED_THRESHOLD: 25,  // REDUCED for much more permissive detection
    MAX_RED_THRESHOLD: 255, // Increased to maximum
    STABILITY_WINDOW: 4,
    MIN_STABILITY_COUNT: 2  // Reduced to require less stability
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private readonly BUFFER_SIZE = 12;
  private readonly MIN_RED_THRESHOLD = 25; // REDUCED
  private readonly MAX_RED_THRESHOLD = 255; // Increased
  private readonly STABILITY_WINDOW = 4;
  private readonly MIN_STABILITY_COUNT = 2; // Reduced
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.03; // Reduced threshold

  // Variables for dynamic threshold adaptation
  private dynamicThreshold: number = 0;
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 20;
  private readonly ADAPTATION_RATE = 0.15;
  
  // Signal amplifier for additional improvements
  private signalAmplifier: SignalAmplifier;
  private lastAmplifiedValue: number = 0;
  private signalQuality: number = 0;
  
  // New: Variables for improved finger detection
  private consecutiveWeakSignals: number = 0;
  private readonly MAX_WEAK_SIGNALS = 5; // Increased tolerance
  private readonly WEAK_SIGNAL_THRESHOLD = 0.08; // Lower threshold
  
  // False positive prevention
  private baselineValues: number[] = [];
  private readonly BASELINE_SIZE = 10;
  private hasEstablishedBaseline: boolean = false;
  
  // NEW: Counter for signal presence regardless of quality
  private signalPresenceCounter: number = 0;
  private readonly MIN_SIGNAL_PRESENCE = 3;

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
      this.signalPresenceCounter = 0;
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
    this.signalPresenceCounter = 0;
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
      
      // Check if we have any data first
      if (redValue > 0) {
        this.signalPresenceCounter = Math.min(10, this.signalPresenceCounter + 1);
      } else {
        this.signalPresenceCounter = Math.max(0, this.signalPresenceCounter - 1);
      }
      
      // Establish baseline for better false positive rejection
      // But make it faster and more permissive
      if (!this.hasEstablishedBaseline) {
        this.baselineValues.push(redValue);
        if (this.baselineValues.length > 5) { // Reduced from BASELINE_SIZE
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
            // NEW: Even with no baseline, if we have signal, show some finger detection
            const hasMinimalSignal = this.signalPresenceCounter >= this.MIN_SIGNAL_PRESENCE;
            
            this.onSignalReady({
              timestamp: Date.now(),
              rawValue: redValue,
              filteredValue: 0,
              quality: hasMinimalSignal ? 10 : 0, // Minimal quality if signal present
              fingerDetected: hasMinimalSignal, // Detect finger with minimal signal
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

      // Analysis with amplified value and more permissive finger detection
      const { isFingerDetected, quality: detectionQuality } = this.analyzeSignal(amplifiedValue, redValue);
      
      // Check for weak signal to detect finger removal or poor placement
      // NEW: More permissive weak signal threshold
      const isWeakSignal = Math.abs(amplifiedValue) < this.WEAK_SIGNAL_THRESHOLD;
      
      if (isWeakSignal) {
        this.consecutiveWeakSignals++;
      } else {
        this.consecutiveWeakSignals = Math.max(0, this.consecutiveWeakSignals - 1);
      }
      
      // NEW: More permissive logic - Detect finger even with some weak signals
      // Only override finger detection if we have MANY consecutive weak signals
      const finalFingerDetected = isFingerDetected || (this.consecutiveWeakSignals < this.MAX_WEAK_SIGNALS && 
                                                      this.signalPresenceCounter >= this.MIN_SIGNAL_PRESENCE);
      
      // Use amplifier quality for better detection
      const perfusionIndex = this.calculatePerfusionIndex();
      
      // NEW: More permissive quality calculation
      let combinedQuality = 0;
      if (finalFingerDetected) {
        // Base quality on detection quality, but always provide at least minimal quality
        combinedQuality = Math.max(10, Math.round((detectionQuality * 0.7 + this.signalQuality * 100 * 0.3)));
      } else if (this.signalPresenceCounter >= this.MIN_SIGNAL_PRESENCE) {
        // If signal is present but not strong enough for full detection, still provide minimal quality
        combinedQuality = 10;
      }

      console.log("PPGSignalProcessor: Analysis with improved detection", {
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
        signalPresenceCounter: this.signalPresenceCounter
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

  private updateDynamicThreshold(): void {
    const min = Math.min(...this.signalHistory);
    const max = Math.max(...this.signalHistory);
    const range = max - min;
    
    // Calculate new threshold based on signal range - MORE PERMISSIVE
    const newThreshold = range * 0.20; // Reduced from 0.30 to 0.20 
    
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
    
    // Analyze a larger area of the image for better detection (50% central)
    const startX = Math.floor(imageData.width * 0.25);
    const endX = Math.floor(imageData.width * 0.75);
    const startY = Math.floor(imageData.height * 0.25);
    const endY = Math.floor(imageData.height * 0.75);
    
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
    // Use dynamic threshold for better adaptation with a LOWER minimum threshold
    const effectiveThreshold = Math.max(
      this.MIN_RED_THRESHOLD, // Already lowered to 25
      this.dynamicThreshold > 0 ? this.dynamicThreshold : this.MIN_RED_THRESHOLD
    );
                              
    // Check if the value is in range
    const isInRange = rawValue >= effectiveThreshold && rawValue <= this.MAX_RED_THRESHOLD;
    
    // NEW: More permissive finger detection - even if not perfectly in range
    // We count permissively if there's at least some signal
    const isPermissiveInRange = rawValue >= this.MIN_RED_THRESHOLD * 0.8 && rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isPermissiveInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < 3) { // Reduced from STABILITY_WINDOW
      return { isFingerDetected: false, quality: 0 };
    }

    // NEW: Use smaller window for faster detection 
    const recentValues = this.lastValues.slice(-3);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Enhanced variation analysis to detect peaks - More permissive
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Use amplifier quality to adjust thresholds - More permissive
    const qualityFactor = 0.9 + (this.signalQuality * 0.3); // 0.9-1.2
    
    // More sensitive detection of cardiac peaks
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    // NEW: Much more permissive thresholds
    const adaptiveThreshold = Math.max(2.0, avgValue * 0.03 * qualityFactor);
    const isStable = maxVariation < adaptiveThreshold * 3.0 || 
                    minVariation > -adaptiveThreshold * 3.0; // Changed AND to OR

    if (isStable || this.signalPresenceCounter >= this.MIN_SIGNAL_PRESENCE) { // Added signal presence check
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      // More gradual reduction to maintain better detection
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.25); // Reduced from 0.5
    }

    // NEW: Much more permissive finger detection logic
    // Count finger as detected with lower stability count and quality requirements
    const isFingerDetected = 
      (this.stableFrameCount >= this.MIN_STABILITY_COUNT * 0.75) || // Only need 75% of stability
      (this.signalQuality > 0.3) || // Lower quality threshold
      (this.signalPresenceCounter >= this.MIN_SIGNAL_PRESENCE); // Or consistent signal presence
    
    let quality = 0;
    if (isFingerDetected) {
      // Improved quality calculation with amplifier - More permissive
      const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - (effectiveThreshold * 0.8)) / 
                                    (this.MAX_RED_THRESHOLD - (effectiveThreshold * 0.8)), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 4)));
      const amplifierScore = this.signalQuality;
      const presenceScore = this.signalPresenceCounter / 10;
      
      // NEW: Weighted with more weight to signal presence for stability
      quality = Math.round((
        stabilityScore * 0.25 + 
        intensityScore * 0.25 + 
        variationScore * 0.2 + 
        amplifierScore * 0.15 +
        presenceScore * 0.15
      ) * 100);
    } else if (this.signalPresenceCounter >= this.MIN_SIGNAL_PRESENCE) {
      // Minimal quality for signal presence even if not technically "detected"
      quality = 15;
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
