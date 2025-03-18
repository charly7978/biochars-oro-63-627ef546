import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

/**
 * Kalman filter implementation for signal smoothing
 */
class KalmanFilter {
  private R: number = 0.01;  // Measurement noise
  private Q: number = 0.1;   // Process noise
  private P: number = 1;     // Error estimation
  private X: number = 0;     // Estimated value
  private K: number = 0;     // Kalman gain

  filter(measurement: number): number {
    // Prediction
    this.P = this.P + this.Q;
    
    // Update
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

/**
 * PPG Signal Processor (Photoplethysmography)
 * Implements the SignalProcessor interface
 */
export class PPGSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private lastValues: number[] = [];
  
  // Default configuration
  private readonly BUFFER_SIZE = 15;
  private readonly MIN_RED_THRESHOLD = 30;
  private readonly MAX_RED_THRESHOLD = 250;
  private readonly STABILITY_WINDOW = 4;
  private readonly MIN_STABILITY_COUNT = 2;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  
  // Consistency analysis parameters
  private consistencyHistory: number[] = [];
  private readonly CONSISTENCY_BUFFER_SIZE = 8;
  private movementScores: number[] = []; 
  private readonly MOVEMENT_HISTORY_SIZE = 10;
  private readonly MAX_MOVEMENT_THRESHOLD = 15;
  private readonly MIN_PERIODICITY_SCORE = 0.25;
  
  // Temporal processing
  private lastProcessedTime: number = 0;
  private readonly MIN_PROCESS_INTERVAL = 30;
  
  // Periodicity analysis
  private readonly PERIODICITY_BUFFER_SIZE = 60;
  private periodicityBuffer: number[] = [];
  private lastPeriodicityScore: number = 0;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    console.log("PPGSignalProcessor: Instance created");
  }

  /**
   * Initialize the processor
   */
  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.kalmanFilter.reset();
      this.consistencyHistory = [];
      this.movementScores = [];
      this.periodicityBuffer = [];
      this.lastPeriodicityScore = 0;
      console.log("PPGSignalProcessor: Initialized");
    } catch (error) {
      console.error("PPGSignalProcessor: Initialization error", error);
      this.handleError("INIT_ERROR", "Error initializing processor");
    }
  }

  /**
   * Start signal processing
   */
  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Started");
  }

  /**
   * Stop signal processing
   */
  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.kalmanFilter.reset();
    this.consistencyHistory = [];
    this.movementScores = [];
    this.periodicityBuffer = [];
    console.log("PPGSignalProcessor: Stopped");
  }

  /**
   * Reset to default configuration
   */
  resetToDefault(): void {
    this.initialize();
    console.log("PPGSignalProcessor: Configuration reset to defaults");
  }

  /**
   * Process a frame to extract PPG information
   */
  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Frequency control to avoid processing overload
      const now = Date.now();
      if (now - this.lastProcessedTime < this.MIN_PROCESS_INTERVAL) {
        return;
      }
      this.lastProcessedTime = now;
      
      // Extract red channel (main channel for PPG)
      const redValue = this.extractRedChannel(imageData);
      
      // Apply initial filtering to reduce noise
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Store for analysis
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }
      
      // Add to periodicity buffer
      this.periodicityBuffer.push(filtered);
      if (this.periodicityBuffer.length > this.PERIODICITY_BUFFER_SIZE) {
        this.periodicityBuffer.shift();
      }
      
      // Calculate consistency over time
      this.updateConsistencyMetrics(filtered);
      
      // Calculate movement score (instability)
      const movementScore = this.calculateMovementScore();
      
      // Analyze signal to determine quality and finger presence
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue, movementScore);
      
      // Calculate perfusion index
      const perfusionIndex = this.calculatePerfusionIndex();
      
      // Analyze periodicity if we have enough data
      if (this.periodicityBuffer.length > 30) {
        this.lastPeriodicityScore = this.analyzeSignalPeriodicity();
      }
      
      // Calculate spectrum data
      const spectrumData = this.calculateSpectrumData();

      // Create processed signal
      const processedSignal: ProcessedSignal = {
        timestamp: now,
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue),
        perfusionIndex,
        spectrumData
      };

      // Send processed signal
      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error processing frame", error);
      this.handleError("PROCESSING_ERROR", "Error processing frame");
    }
  }
  
  /**
   * Calculate frequency spectrum data
   */
  private calculateSpectrumData() {
    if (this.periodicityBuffer.length < 30) {
      return undefined;
    }
    
    // Basic implementation, could be improved with real FFT
    const buffer = this.periodicityBuffer.slice(-30);
    const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    const normalizedBuffer = buffer.map(v => v - mean);
    
    // Simulate simple spectral analysis
    const frequencies: number[] = [];
    const amplitudes: number[] = [];
    
    // Calculate amplitudes for different frequencies
    for (let freq = 0.5; freq <= 4.0; freq += 0.1) {
      frequencies.push(freq);
      
      let amplitude = 0;
      for (let i = 0; i < normalizedBuffer.length; i++) {
        const phase = (i / normalizedBuffer.length) * Math.PI * 2 * freq;
        amplitude += normalizedBuffer[i] * Math.sin(phase);
      }
      amplitude = Math.abs(amplitude) / normalizedBuffer.length;
      amplitudes.push(amplitude);
    }
    
    // Find the dominant frequency
    let maxIndex = 0;
    for (let i = 1; i < amplitudes.length; i++) {
      if (amplitudes[i] > amplitudes[maxIndex]) {
        maxIndex = i;
      }
    }
    
    return {
      frequencies,
      amplitudes,
      dominantFrequency: frequencies[maxIndex]
    };
  }
  
  /**
   * Update consistency metrics
   */
  private updateConsistencyMetrics(value: number): void {
    this.consistencyHistory.push(value);
    if (this.consistencyHistory.length > this.CONSISTENCY_BUFFER_SIZE) {
      this.consistencyHistory.shift();
    }
  }
  
  /**
   * Calculate movement score (0-100, where 0 is very stable)
   */
  private calculateMovementScore(): number {
    if (this.consistencyHistory.length < 4) {
      return 100; // Maximum movement if not enough data
    }
    
    // Calculate variations between consecutive samples
    const variations: number[] = [];
    for (let i = 1; i < this.consistencyHistory.length; i++) {
      variations.push(Math.abs(this.consistencyHistory[i] - this.consistencyHistory[i-1]));
    }
    
    // Calculate standard deviation
    const mean = variations.reduce((a, b) => a + b, 0) / variations.length;
    const variance = variations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / variations.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate score (normalized to 0-100)
    const score = Math.min(100, stdDev * 10);
    
    // Keep history for smoothing
    this.movementScores.push(score);
    if (this.movementScores.length > this.MOVEMENT_HISTORY_SIZE) {
      this.movementScores.shift();
    }
    
    // Return weighted average (more weight to recent values)
    let weightedSum = 0;
    let weightSum = 0;
    this.movementScores.forEach((s, i) => {
      const weight = i + 1;
      weightedSum += s * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : 100;
  }

  /**
   * Extract red channel from a frame
   * The red channel is the most sensitive to changes in blood volume
   */
  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    // Analyze a larger part of the image (40% central)
    const startX = Math.floor(imageData.width * 0.3);
    const endX = Math.floor(imageData.width * 0.7);
    const startY = Math.floor(imageData.height * 0.3);
    const endY = Math.floor(imageData.height * 0.7);
    
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

  /**
   * Calculate perfusion index
   */
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

  /**
   * Analyze signal to determine quality and finger presence
   * Includes movement and periodicity analysis as factors
   */
  private analyzeSignal(
    filtered: number, 
    rawValue: number, 
    movementScore: number
  ): { isFingerDetected: boolean, quality: number } {
    // Basic threshold check
    const isInRange = rawValue >= this.MIN_RED_THRESHOLD && rawValue <= this.MAX_RED_THRESHOLD;
    
    // If completely out of range, no finger
    if (!isInRange) {
      // Gradually reduce stability counter instead of resetting
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
      return { isFingerDetected: this.stableFrameCount > 0, quality: Math.max(0, this.stableFrameCount * 10) };
    }

    // Check if we have enough samples to analyze
    if (this.lastValues.length < 3) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Analyze signal stability
    const recentValues = this.lastValues.slice(-this.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Evaluate variations between consecutive samples
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Adaptive threshold based on average
    const adaptiveThreshold = Math.max(2.0, avgValue * 0.03);
    
    // Detect stability
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    const isStable = maxVariation < adaptiveThreshold * 3 && 
                    minVariation > -adaptiveThreshold * 3;
    
    // Adjust stability counter
    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 0.5, this.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      // More gradual reduction
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.2);
    }
    
    // Movement factor
    const movementFactor = Math.max(0, 1 - (movementScore / this.MAX_MOVEMENT_THRESHOLD));
    
    // Periodicity factor
    const periodicityFactor = Math.max(0.3, this.lastPeriodicityScore);
    
    // Calculate quality weighting multiple factors
    let quality = 0;
    
    // Always calculate quality, even with low stability
    const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 1.5), 1);
    const intensityScore = Math.min((rawValue - this.MIN_RED_THRESHOLD) / 
                                  (this.MAX_RED_THRESHOLD - this.MIN_RED_THRESHOLD), 1);
    const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 4)));
    
    // Weighted calculation
    quality = Math.round((stabilityScore * 0.4 + 
                        intensityScore * 0.3 + 
                        variationScore * 0.1 + 
                        movementFactor * 0.1 + 
                        periodicityFactor * 0.1) * 100);
    
    // More permissive detection
    const minQualityThreshold = 30;
    const isFingerDetected = this.stableFrameCount >= this.MIN_STABILITY_COUNT * 0.7 && 
                            quality >= minQualityThreshold;

    return { isFingerDetected, quality };
  }

  /**
   * Analyze signal periodicity to determine quality
   * Looks for rhythmic patterns consistent with cardiac pulse
   */
  private analyzeSignalPeriodicity(): number {
    if (this.periodicityBuffer.length < 30) {
      return 0.3; // Base value to avoid penalizing too much at start
    }
    
    const signal = this.periodicityBuffer.slice(-30);
    const signalMean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    
    const normalizedSignal = signal.map(val => val - signalMean);
    
    // More permissive with lag range
    const maxLag = 25;
    const correlations: number[] = [];
    
    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0;
      let denominator = 0;
      
      for (let i = 0; i < normalizedSignal.length - lag; i++) {
        correlation += normalizedSignal[i] * normalizedSignal[i + lag];
        denominator += normalizedSignal[i] * normalizedSignal[i];
      }
      
      if (denominator > 0) {
        correlation /= Math.sqrt(denominator);
        correlations.push(Math.abs(correlation));
      } else {
        correlations.push(0);
      }
    }
    
    let maxCorrelation = 0.3; // Minimum base value
    let periodFound = false;
    
    // Allow a wider range of frequencies
    for (let i = 1; i < correlations.length - 1; i++) {
      if (correlations[i] > correlations[i-1] && 
          correlations[i] > correlations[i+1] && 
          correlations[i] > 0.15) {
        
        // Expanded range to allow more variability
        if (i >= 3 && i <= 20) {
          if (correlations[i] > maxCorrelation) {
            maxCorrelation = correlations[i];
            periodFound = true;
          }
        }
      }
    }
    
    // Always return a reasonable minimum value
    return Math.max(0.3, Math.min(1.0, maxCorrelation));
  }

  /**
   * Detect region of interest for analysis
   */
  private detectROI(redValue: number): ProcessedSignal['roi'] {
    return {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    };
  }

  /**
   * Handle processor errors
   */
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
