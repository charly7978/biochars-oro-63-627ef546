
import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

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
  private readonly BUFFER_SIZE = 12;
  private readonly MIN_RED_THRESHOLD = 85;
  private readonly MAX_RED_THRESHOLD = 245;
  private readonly STABILITY_WINDOW = 4;
  private readonly MIN_STABILITY_COUNT = 3;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.06;

  // Variables for dynamic threshold adaptation
  private dynamicThreshold: number = 0;
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 20;
  private readonly ADAPTATION_RATE = 0.15;
  
  // Signal quality variables
  private lastAmplifiedValue: number = 0;
  private signalQuality: number = 0;
  
  // Variables for improved finger detection
  private consecutiveWeakSignals: number = 0;
  private readonly MAX_WEAK_SIGNALS = 3;
  private readonly WEAK_SIGNAL_THRESHOLD = 0.15;
  
  // False positive prevention
  private baselineValues: number[] = [];
  private readonly BASELINE_SIZE = 10;
  private hasEstablishedBaseline: boolean = false;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    console.log("PPGSignalProcessor: Instance created");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.kalmanFilter.reset();
      this.signalHistory = [];
      this.dynamicThreshold = 0;
      this.lastAmplifiedValue = 0;
      this.signalQuality = 0;
      this.consecutiveWeakSignals = 0;
      this.baselineValues = [];
      this.hasEstablishedBaseline = false;
      console.log("PPGSignalProcessor: Initialized");
    } catch (error) {
      console.error("PPGSignalProcessor: Initialization error", error);
      this.handleError("INIT_ERROR", "Error initializing processor");
    }
  }

  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Started");
  }

  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.kalmanFilter.reset();
    this.signalHistory = [];
    this.dynamicThreshold = 0;
    this.lastAmplifiedValue = 0;
    this.signalQuality = 0;
    this.consecutiveWeakSignals = 0;
    this.baselineValues = [];
    this.hasEstablishedBaseline = false;
    console.log("PPGSignalProcessor: Stopped");
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      console.log("PPGSignalProcessor: Not processing");
      return;
    }

    try {
      const redValue = this.extractRedChannel(imageData);
      
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
      
      // Apply direct filtering without amplification
      const amplifiedValue = filtered;
      this.lastAmplifiedValue = amplifiedValue;
      this.signalQuality = this.calculateSignalQuality(amplifiedValue);
      
      // Save value in buffer
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

      // Analysis with filtered value
      const { isFingerDetected, quality: detectionQuality } = this.analyzeSignal(amplifiedValue, redValue);
      
      // Check for weak signal to detect finger removal or poor placement
      const isWeakSignal = Math.abs(amplifiedValue) < this.WEAK_SIGNAL_THRESHOLD;
      
      if (isWeakSignal) {
        this.consecutiveWeakSignals++;
      } else {
        this.consecutiveWeakSignals = Math.max(0, this.consecutiveWeakSignals - 1);
      }
      
      // Override finger detection if we have too many weak signals
      const finalFingerDetected = isFingerDetected && (this.consecutiveWeakSignals < this.MAX_WEAK_SIGNALS);
      
      // Calculate perfusion index
      const perfusionIndex = this.calculatePerfusionIndex();
      const combinedQuality = finalFingerDetected ? 
        Math.round((detectionQuality * 0.7 + this.signalQuality * 100 * 0.3)) : 0;

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
      console.error("PPGSignalProcessor: Error processing frame", error);
      this.handleError("PROCESSING_ERROR", "Error processing frame");
    }
  }

  private updateDynamicThreshold(): void {
    const min = Math.min(...this.signalHistory);
    const max = Math.max(...this.signalHistory);
    const range = max - min;
    
    // Calculate new threshold based on signal range
    const newThreshold = range * 0.30;
    
    // Update dynamically with smoothing
    if (this.dynamicThreshold === 0) {
      this.dynamicThreshold = newThreshold;
    } else {
      this.dynamicThreshold = (1 - this.ADAPTATION_RATE) * this.dynamicThreshold + 
                             this.ADAPTATION_RATE * newThreshold;
    }
  }

  private calculateSignalQuality(value: number): number {
    if (this.lastValues.length < 5) return 0;
    
    // Calculate simple signal quality based on stability
    const recent = this.lastValues.slice(-5);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;
    
    // Lower variance means higher quality (0-1)
    return Math.max(0, Math.min(1, 1 - (Math.sqrt(variance) / 10)));
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
    
    // Only analyze the center of the image (30% central)
    const startX = Math.floor(imageData.width * 0.35);
    const endX = Math.floor(imageData.width * 0.65);
    const startY = Math.floor(imageData.height * 0.35);
    const endY = Math.floor(imageData.height * 0.65);
    
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
    // Use dynamic threshold for better adaptation with a minimum threshold
    const effectiveThreshold = Math.max(
      this.MIN_RED_THRESHOLD,
      this.dynamicThreshold > 0 ? this.dynamicThreshold : this.MIN_RED_THRESHOLD
    );
                              
    // Check if the value is in range
    const isInRange = rawValue >= effectiveThreshold && rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < this.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Analyze stability
    const recentValues = this.lastValues.slice(-this.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calculate variations
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Detect stability
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    const adaptiveThreshold = Math.max(1.5, avgValue * 0.022);
    const isStable = maxVariation < adaptiveThreshold * 2.0 && 
                    minVariation > -adaptiveThreshold * 2.0;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    const isFingerDetected = this.stableFrameCount >= this.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - effectiveThreshold) / 
                                    (this.MAX_RED_THRESHOLD - effectiveThreshold), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 3)));
      
      quality = Math.round((
        stabilityScore * 0.5 + 
        intensityScore * 0.3 + 
        variationScore * 0.2
      ) * 100);
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
