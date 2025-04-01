/**
 * Signal Processing Utilities
 * Consolidated library for all signal processing functions
 */

/**
 * Kalman Filter implementation for signal smoothing
 */
export class KalmanFilter {
  private R: number = 0.008; // Measurement noise
  private Q: number = 0.12;  // Process noise
  private P: number = 1;     // Estimation error covariance
  private X: number = 0;     // Estimated value
  private K: number = 0;     // Kalman gain

  /**
   * Apply Kalman filter to a measurement
   */
  filter(measurement: number): number {
    // Prediction step
    this.P = this.P + this.Q;
    
    // Update step
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    
    return this.X;
  }

  /**
   * Reset filter state
   */
  reset(): void {
    this.X = 0;
    this.P = 1;
  }
  
  /**
   * Update filter parameters
   */
  updateParameters(params: { R?: number; Q?: number }): void {
    if (params.R !== undefined) this.R = params.R;
    if (params.Q !== undefined) this.Q = params.Q;
  }
}

/**
 * Simple Moving Average (SMA) filter
 */
export function applySMAFilter(
  value: number,
  buffer: number[],
  windowSize: number = 5
): { filteredValue: number; updatedBuffer: number[] } {
  const updatedBuffer = [...buffer, value];
  
  // Keep buffer at window size
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  
  // Calculate average
  const filteredValue = updatedBuffer.reduce((a, b) => a + b, 0) / updatedBuffer.length;
  
  return { filteredValue, updatedBuffer };
}

/**
 * Exponential Moving Average (EMA) filter
 */
export function applyEMAFilter(
  value: number,
  previousEMA: number | null,
  alpha: number = 0.3
): number {
  if (previousEMA === null) return value;
  return alpha * value + (1 - alpha) * previousEMA;
}

/**
 * Median filter implementation
 */
export function applyMedianFilter(
  value: number,
  buffer: number[],
  windowSize: number = 5
): { filteredValue: number; updatedBuffer: number[] } {
  const updatedBuffer = [...buffer, value];
  
  // Keep buffer at window size
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  
  // Calculate median
  const sortedValues = [...updatedBuffer].sort((a, b) => a - b);
  const filteredValue = sortedValues[Math.floor(sortedValues.length / 2)];
  
  return { filteredValue, updatedBuffer };
}

/**
 * Advanced baseline tracking for signal normalization
 */
export function trackBaseline(
  currentValue: number,
  currentBaseline: number,
  factor: number = 0.995
): number {
  return currentBaseline * factor + currentValue * (1 - factor);
}

/**
 * Calculate signal quality based on multiple metrics
 */
export function calculateSignalQuality(
  recentValues: number[],
  minAmplitude: number = 0.05,
  maxVariation: number = 1.8
): number {
  if (recentValues.length < 10) return 0;
  
  const min = Math.min(...recentValues);
  const max = Math.max(...recentValues);
  const range = max - min;
  
  // Amplitude check
  if (range < minAmplitude) return 20;
  
  // Calculate mean and standard deviation
  const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
  const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
  const stdDev = Math.sqrt(variance);
  
  // Coefficient of variation (normalized standard deviation)
  const cv = stdDev / Math.abs(mean);
  
  // Calculate scores for different quality aspects
  const amplitudeScore = range < minAmplitude ? 20 : 
                       range > maxVariation ? 60 : 
                       90;
  
  const variabilityScore = cv < 0.01 ? 30 : 
                         cv > 0.5 ? 40 : 
                         90;
  
  // Find peaks for regularity analysis
  const peakIndices: number[] = [];
  for (let i = 2; i < recentValues.length - 2; i++) {
    const v = recentValues[i];
    if (v > recentValues[i-1] && v > recentValues[i-2] && 
        v > recentValues[i+1] && v > recentValues[i+2]) {
      peakIndices.push(i);
    }
  }
  
  // Calculate peak regularity if we have enough peaks
  let regularityScore = 50;
  if (peakIndices.length >= 3) {
    const intervals: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      intervals.push(peakIndices[i] - peakIndices[i-1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const intervalVariability = intervals.reduce((a, b) => a + Math.abs(b - avgInterval), 0) / intervals.length;
    
    // Normalize variability and convert to score
    const normalizedVariability = intervalVariability / avgInterval;
    regularityScore = 100 - (normalizedVariability * 100);
    regularityScore = Math.max(30, Math.min(100, regularityScore));
  }
  
  // Weighted final score
  return (amplitudeScore * 0.4) + (variabilityScore * 0.3) + (regularityScore * 0.3);
}

/**
 * Enhanced robust finger detection system with lock-in mechanism
 */
export class FingerDetectionSystem {
  private qualityHistory: number[] = [];
  private fingerDetectedHistory: boolean[] = [];
  private signalLockCounter: number = 0;
  private consecutiveNonDetection: number = 0;
  private detectionThreshold: number = 0.6;
  
  // Constants
  private readonly HISTORY_SIZE = 5;
  private readonly MAX_SIGNAL_LOCK = 5;
  private readonly RELEASE_GRACE_PERIOD = 3;
  private readonly MIN_DETECTION_THRESHOLD = 0.4;
  
  /**
   * Process a new signal and determine if a finger is detected
   */
  processDetection(
    rawDetection: boolean,
    signalQuality: number,
    signalStrength: number
  ): { fingerDetected: boolean; enhancedQuality: number } {
    // Update detection history
    this.fingerDetectedHistory.push(rawDetection);
    if (this.fingerDetectedHistory.length > this.HISTORY_SIZE) {
      this.fingerDetectedHistory.shift();
    }
    
    // Update quality history
    this.qualityHistory.push(signalQuality);
    if (this.qualityHistory.length > this.HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
    
    // Calculate detection ratio
    const rawDetectionRatio = this.fingerDetectedHistory.filter(d => d).length / 
                             Math.max(1, this.fingerDetectedHistory.length);
    
    // Calculate weighted quality
    let weightedQualitySum = 0;
    let weightSum = 0;
    this.qualityHistory.forEach((quality, index) => {
      const weight = Math.pow(1.5, index); // Exponential weighting for recent values
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    // Implement lock-in mechanism
    if (rawDetection) {
      this.consecutiveNonDetection = 0;
      this.signalLockCounter = Math.min(this.MAX_SIGNAL_LOCK, this.signalLockCounter + 1);
    } else {
      // Reduce lock counter with grace period
      if (this.signalLockCounter >= this.MAX_SIGNAL_LOCK) {
        this.consecutiveNonDetection++;
        
        if (this.consecutiveNonDetection > this.RELEASE_GRACE_PERIOD) {
          this.signalLockCounter = Math.max(0, this.signalLockCounter - 1);
        }
      } else {
        this.signalLockCounter = Math.max(0, this.signalLockCounter - 1);
      }
    }
    
    // Apply adaptive threshold based on signal conditions
    const signalStrengthFactor = Math.min(1, Math.max(0.8, signalStrength));
    const effectiveThreshold = this.detectionThreshold * signalStrengthFactor;
    
    // Determine final detection state
    const isLockedIn = this.signalLockCounter >= this.MAX_SIGNAL_LOCK - 1;
    const robustFingerDetected = isLockedIn || rawDetectionRatio >= effectiveThreshold;
    
    // Enhance quality for better UX
    const enhancementFactor = robustFingerDetected ? 1.1 : 1.0;
    const enhancedQuality = Math.min(100, avgQuality * enhancementFactor);
    
    return { fingerDetected: robustFingerDetected, enhancedQuality };
  }
  
  /**
   * Adaptively update the detection threshold
   */
  updateDetectionThreshold(consistentDetection: boolean, inconsistentDetection: boolean, avgQuality: number): void {
    if (inconsistentDetection) {
      // Make detection easier if there are persistent problems
      this.detectionThreshold = Math.max(
        this.MIN_DETECTION_THRESHOLD,
        this.detectionThreshold - 0.05
      );
    } else if (consistentDetection && avgQuality < 40) {
      // Be more strict if we detect consistently but quality is poor
      this.detectionThreshold = Math.min(
        0.7,
        this.detectionThreshold + 0.03
      );
    }
  }
  
  /**
   * Reset the detection system
   */
  reset(): void {
    this.qualityHistory = [];
    this.fingerDetectedHistory = [];
    this.signalLockCounter = 0;
    this.consecutiveNonDetection = 0;
    this.detectionThreshold = 0.6;
  }
  
  /**
   * Get the current detection status
   */
  getStatus(): { 
    lockLevel: number; 
    detectionRatio: number;
    threshold: number;
    consecutiveNonDetection: number;
  } {
    return {
      lockLevel: this.signalLockCounter,
      detectionRatio: this.fingerDetectedHistory.filter(d => d).length / 
                     Math.max(1, this.fingerDetectedHistory.length),
      threshold: this.detectionThreshold,
      consecutiveNonDetection: this.consecutiveNonDetection
    };
  }
}

/**
 * Find peaks and valleys in a signal
 */
export function findPeaksAndValleys(values: number[]): { 
  peakIndices: number[]; 
  valleyIndices: number[] 
} {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  // Algorithm for peak and valley detection using a 5-point window
  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    // Peak detection (highest point in a 5-point window)
    if (
      v > values[i - 1] &&
      v > values[i - 2] &&
      v > values[i + 1] &&
      v > values[i + 2]
    ) {
      peakIndices.push(i);
    }
    // Valley detection (lowest point in a 5-point window)
    if (
      v < values[i - 1] &&
      v < values[i - 2] &&
      v < values[i + 1] &&
      v < values[i + 2]
    ) {
      valleyIndices.push(i);
    }
  }
  return { peakIndices, valleyIndices };
}

/**
 * Calculate BPM from time intervals
 */
export function calculateBPMFromIntervals(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  // Sort and trim outliers
  const sorted = [...intervals].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);  // Remove potential outliers
  
  if (trimmed.length === 0) return 0;
  
  // Calculate average interval in milliseconds
  const avgInterval = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  
  // Convert to BPM
  return avgInterval > 0 ? 60000 / avgInterval : 0;
}
