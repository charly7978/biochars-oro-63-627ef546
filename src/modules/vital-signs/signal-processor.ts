
/**
 * Professional medical-grade signal processor for PPG signals
 * Implements strict validation and precise filtering techniques
 * with zero simulation of data
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private readonly SMA_WINDOW_SIZE = 6; // Increased window size for stronger filtering
  private readonly MIN_VALID_VALUE = 0.02; // Increased minimum valid signal strength
  private readonly MAX_VALID_VALUE = 245; // Maximum valid signal value (reduced)
  private readonly VARIANCE_THRESHOLD = 0.8; // Increased minimum variance for valid signal
  private readonly MIN_SAMPLES_FOR_VALIDATION = 12; // Increased minimum samples needed
  
  // Tracking signal quality for detection of false positives
  private qualityHistory: number[] = [];
  private readonly QUALITY_HISTORY_SIZE = 8;
  private readonly MIN_QUALITY_THRESHOLD = 35; // Minimum quality to be considered valid
  
  /**
   * Get current PPG values buffer with validation
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
  
  /**
   * Apply Simple Moving Average filter with enhanced strict validation
   */
  public applySMAFilter(value: number): number {
    // Aggressive input validation
    if (isNaN(value) || !isFinite(value)) {
      console.warn("SignalProcessor: Rejected invalid value in SMA filter");
      return 0;
    }
    
    // Validate physiological plausibility
    if (value < this.MIN_VALID_VALUE || value > this.MAX_VALID_VALUE) {
      console.warn("SignalProcessor: Rejected implausible value in filter:", value);
      // Don't add to buffer, return minimal value
      return this.MIN_VALID_VALUE;
    }
    
    const windowSize = this.SMA_WINDOW_SIZE;
    
    if (this.ppgValues.length < windowSize) {
      // Not enough data for proper filtering
      this.ppgValues.push(value);
      return value;
    }
    
    const recentValues = this.ppgValues.slice(-windowSize);
    
    // Enhanced signal quality assessment with multiple metrics
    const variance = this.calculateVariance(recentValues);
    const isValidSignal = variance > this.VARIANCE_THRESHOLD;
    
    // Calculate signal quality score
    const qualityScore = this.calculateSignalQuality(recentValues);
    this.updateQualityHistory(qualityScore);
    
    const averageQuality = this.getAverageQuality();
    const isQualityAcceptable = averageQuality >= this.MIN_QUALITY_THRESHOLD;
    
    if (!isValidSignal && this.ppgValues.length > this.MIN_SAMPLES_FOR_VALIDATION) {
      console.warn("SignalProcessor: Low quality signal detected, applying aggressive filtering", {
        variance,
        qualityScore,
        averageQuality,
        threshold: this.VARIANCE_THRESHOLD
      });
      
      // Apply much stronger filtering for low quality signals
      const median = this.calculateMedian(recentValues);
      
      // Very aggressive smoothing (90% median, 10% new value)
      const filteredValue = (median * 0.9) + (value * 0.1);
      this.ppgValues.push(value);
      return filteredValue;
    }
    
    // More conservative SMA for good quality signals
    const sum = recentValues.reduce((acc, val) => acc + val, 0);
    const filtered = (sum + value) / (windowSize + 1);
    this.ppgValues.push(value);
    return filtered;
  }
  
  /**
   * Apply Exponential Moving Average filter with enhanced validation
   */
  public applyEMAFilter(value: number, alpha: number = 0.15): number {
    // Reduced alpha for more aggressive smoothing
    if (isNaN(value) || !isFinite(value)) {
      console.warn("SignalProcessor: Rejected invalid value in EMA filter");
      return 0;
    }
    
    // Enhanced physiological validation
    if (value < this.MIN_VALID_VALUE || value > this.MAX_VALID_VALUE) {
      console.warn("SignalProcessor: Rejected implausible value in EMA filter:", value);
      return this.MIN_VALID_VALUE;
    }
    
    if (this.ppgValues.length === 0) {
      this.ppgValues.push(value);
      return value;
    }
    
    const lastValue = this.ppgValues[this.ppgValues.length - 1];
    const filtered = alpha * value + (1 - alpha) * lastValue;
    this.ppgValues.push(value);
    return filtered;
  }
  
  /**
   * Reset the signal processor completely
   */
  public reset(): void {
    this.ppgValues = [];
    this.qualityHistory = [];
    console.log("SignalProcessor: Reset complete - all data cleared");
  }
  
  /**
   * Update signal quality history buffer
   */
  private updateQualityHistory(quality: number): void {
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
  }
  
  /**
   * Get average quality with weighted preference to recent values
   */
  private getAverageQuality(): number {
    if (this.qualityHistory.length === 0) return 0;
    
    let weightedSum = 0;
    let weightSum = 0;
    
    this.qualityHistory.forEach((q, index) => {
      const weight = Math.pow(1.5, index); // Exponential weighting
      weightedSum += q * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : 0;
  }
  
  /**
   * Calculate signal quality score with aggressive false positive prevention
   */
  private calculateSignalQuality(values: number[]): number {
    if (values.length < 5) return 0;
    
    // Calculate variance and amplitude
    const variance = this.calculateVariance(values);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const amplitude = max - min;
    
    // Calculate stability of the signal using windowed standard deviation
    const stabilityScores = [];
    for (let i = 0; i < values.length - 4; i++) {
      const window = values.slice(i, i + 4);
      const windowSD = Math.sqrt(this.calculateVariance(window));
      stabilityScores.push(windowSD);
    }
    
    // Average stability score - lower is more stable
    const avgStability = stabilityScores.reduce((sum, val) => sum + val, 0) / 
                        Math.max(1, stabilityScores.length);
    
    // Penalize very stable signals (potential false positives)
    let stabilityPenalty = 1.0;
    if (avgStability < 0.05 && amplitude < 0.2) {
      stabilityPenalty = 0.2; // Severe penalty for suspiciously stable signals
    }
    
    // Calculate scores for different aspects
    const varianceScore = Math.min(100, variance * 80); // Reward variance up to a point
    const amplitudeScore = Math.min(100, amplitude * 200); // Reward amplitude
    
    // Find peaks for physiological validation
    const peaks = this.findPeaksWithValidation(values);
    const peakScore = Math.min(100, peaks.length * 25); // Reward clear peaks
    
    // Combined weighted score
    const rawScore = (varianceScore * 0.4) + (amplitudeScore * 0.4) + (peakScore * 0.2);
    
    // Apply stability penalty to catch false positives
    return Math.round(rawScore * stabilityPenalty);
  }
  
  /**
   * Calculate heart rate from PPG values with strict validation
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    if (this.ppgValues.length < sampleRate * 4) {
      return 0; // Need at least 4 seconds of data for medical-grade accuracy
    }
    
    // Get recent data (last 8 seconds)
    const recentData = this.ppgValues.slice(-Math.min(this.ppgValues.length, sampleRate * 8));
    
    // Validate signal quality
    const variance = this.calculateVariance(recentData);
    if (variance < this.VARIANCE_THRESHOLD * 2) {
      console.warn("SignalProcessor: Insufficient signal quality for HR calculation");
      return 0;
    }
    
    // Calculate average quality
    const averageQuality = this.getAverageQuality();
    if (averageQuality < this.MIN_QUALITY_THRESHOLD) {
      console.warn("SignalProcessor: Signal quality below threshold for HR calculation");
      return 0;
    }
    
    // Find peaks with strict validation
    const peaks = this.findPeaksWithValidation(recentData);
    
    if (peaks.length < 3) {
      // Need at least 3 peaks for medical-grade calculation
      return 0;
    }
    
    // Calculate intervals between peaks
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    
    // Validate intervals for physiological plausibility
    const isPlausible = this.validateRRIntervals(intervals, sampleRate);
    if (!isPlausible) {
      console.warn("SignalProcessor: Detected non-physiological intervals");
      return 0;
    }
    
    // Calculate average interval with outlier rejection
    const validIntervals = this.removeOutliers(intervals);
    if (validIntervals.length < 2) {
      return 0;
    }
    
    const avgInterval = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    
    // Convert to beats per minute with physiological constraints
    const rawBPM = 60 / (avgInterval / sampleRate);
    
    // Apply physiological constraints (30-200 BPM)
    if (rawBPM < 30 || rawBPM > 200) {
      console.warn("SignalProcessor: Calculated HR outside physiological range");
      return 0;
    }
    
    return Math.round(rawBPM);
  }
  
  /**
   * Find peaks with strict validation criteria
   */
  private findPeaksWithValidation(values: number[]): number[] {
    const peaks: number[] = [];
    const MIN_PEAK_HEIGHT = this.calculateAdaptiveThreshold(values);
    const MIN_PEAK_DISTANCE = 10; // Minimum samples between peaks
    
    // More sophisticated peak detection for medical-grade accuracy
    for (let i = 2; i < values.length - 2; i++) {
      const val = values[i];
      
      // Check if this is a local maximum
      const isLocalMax = val > values[i - 1] && 
                         val > values[i - 2] && 
                         val > values[i + 1] && 
                         val > values[i + 2];
                         
      // Check if peak height is sufficient with more aggressive threshold
      const isPeakHighEnough = val - Math.min(values[i-2], values[i-1], values[i+1], values[i+2]) > MIN_PEAK_HEIGHT * 1.2;
      
      // Check if far enough from last peak
      const isFarEnough = peaks.length === 0 || i - peaks[peaks.length - 1] >= MIN_PEAK_DISTANCE;
      
      if (isLocalMax && isPeakHighEnough && isFarEnough) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Calculate adaptive threshold for peak detection
   */
  private calculateAdaptiveThreshold(values: number[]): number {
    if (values.length === 0) return 1.0;
    
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    
    // Higher threshold (25% of range) for more reliable peak detection
    return Math.max(0.15, range * 0.25);
  }
  
  /**
   * Calculate variance of signal for quality assessment
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Calculate median for robust filtering
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
  
  /**
   * Remove statistical outliers using IQR method
   */
  private removeOutliers(values: number[]): number[] {
    if (values.length < 4) return values;
    
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length / 4);
    const q3Index = Math.floor(sorted.length * 3 / 4);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    const lowerBound = q1 - iqr * 1.5;
    const upperBound = q3 + iqr * 1.5;
    
    return values.filter(val => val >= lowerBound && val <= upperBound);
  }
  
  /**
   * Validate RR intervals for physiological plausibility
   */
  private validateRRIntervals(intervals: number[], sampleRate: number): boolean {
    if (intervals.length < 2) return false;
    
    // Convert to milliseconds
    const msIntervals = intervals.map(i => (i / sampleRate) * 1000);
    
    // Check physiological constraints - tightened range
    const isAnyTooShort = msIntervals.some(i => i < 280); // Faster than 214 BPM (extremely high)
    const isAnyTooLong = msIntervals.some(i => i > 1800); // Slower than 33 BPM (extremely low)
    
    if (isAnyTooShort || isAnyTooLong) {
      return false;
    }
    
    // Check for excessive variability (non-physiological)
    const max = Math.max(...msIntervals);
    const min = Math.min(...msIntervals);
    const rangeRatio = max / min;
    
    if (rangeRatio > 2.0) {
      // More than 100% variation between shortest and longest - reduced from 2.5
      return false;
    }
    
    return true;
  }
  
  /**
   * Basic peak detection method - simplified version for compatibility
   */
  private findPeaks(values: number[]): number[] {
    return this.findPeaksWithValidation(values);
  }
}
