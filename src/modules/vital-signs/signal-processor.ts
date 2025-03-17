
/**
 * Signal processor for PPG signals
 * Implements various filtering and analysis techniques
 * Enhanced to drastically reduce false positives in finger detection
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private readonly SMA_WINDOW_SIZE = 7; // Increased window size for better smoothing
  private readonly MEDIAN_WINDOW_SIZE = 5; // Increased median filter window
  private readonly LOW_PASS_ALPHA = 0.15; // More aggressive low pass filter (reduced from 0.2)
  
  // Noise detection parameters
  private readonly NOISE_THRESHOLD = 20; // Lowered threshold for more sensitive noise detection
  private noiseLevel: number = 0;
  
  // New parameters for detection reliability
  private readonly MIN_REQUIRED_AMPLITUDE = 10; // Minimum amplitude for a valid PPG signal
  private readonly MAX_ALLOWED_AMPLITUDE = 120; // Maximum amplitude for a valid PPG signal
  private readonly MIN_CROSS_ZERO_RATE = 1.5; // Min zero-crossings per second for real PPG
  private readonly MAX_CROSS_ZERO_RATE = 8; // Max zero-crossings per second for real PPG
  private readonly PATTERN_CONSISTENCY_THRESHOLD = 0.6; // Higher pattern consistency requirement
  
  /**
   * Get current PPG values buffer
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
  
  /**
   * Apply Simple Moving Average filter to a value
   */
  public applySMAFilter(value: number): number {
    const windowSize = this.SMA_WINDOW_SIZE;
    
    if (this.ppgValues.length < windowSize) {
      return value;
    }
    
    const recentValues = this.ppgValues.slice(-windowSize);
    const sum = recentValues.reduce((acc, val) => acc + val, 0);
    return (sum + value) / (windowSize + 1);
  }
  
  /**
   * Apply Exponential Moving Average filter
   */
  public applyEMAFilter(value: number, alpha: number = this.LOW_PASS_ALPHA): number {
    if (this.ppgValues.length === 0) {
      return value;
    }
    
    const lastValue = this.ppgValues[this.ppgValues.length - 1];
    return alpha * value + (1 - alpha) * lastValue;
  }
  
  /**
   * Apply median filter
   * Significantly enhanced to remove outliers and impulse noise
   */
  public applyMedianFilter(value: number): number {
    if (this.ppgValues.length < this.MEDIAN_WINDOW_SIZE) {
      return value;
    }
    
    const values = [...this.ppgValues.slice(-this.MEDIAN_WINDOW_SIZE), value];
    values.sort((a, b) => a - b);
    
    // Return the median value
    return values[Math.floor(values.length / 2)];
  }
  
  /**
   * Apply combined filtering for robust signal processing
   * Uses multiple filters in sequence for better results
   */
  public applyFilters(value: number): { filteredValue: number, quality: number } {
    // Step 1: Apply outlier rejection (new)
    const isOutlier = this.detectOutlier(value);
    const cleanValue = isOutlier ? 
      (this.ppgValues.length > 0 ? this.ppgValues[this.ppgValues.length - 1] : value) : 
      value;
    
    // Step 2: Median filter to remove remaining outliers
    const medianFiltered = this.applyMedianFilter(cleanValue);
    
    // Step 3: Low pass filter to smooth the signal
    const lowPassFiltered = this.applyEMAFilter(medianFiltered);
    
    // Step 4: Moving average for final smoothing
    const smaFiltered = this.applySMAFilter(lowPassFiltered);
    
    // Calculate noise level - higher values indicate more noise
    this.updateNoiseLevel(value, smaFiltered);
    
    // Calculate signal quality (0-100) with enhanced criteria
    const quality = this.calculateSignalQuality();
    
    // Store the filtered value in the buffer
    this.ppgValues.push(smaFiltered);
    if (this.ppgValues.length > 40) { // Increased buffer size for better pattern detection
      this.ppgValues.shift();
    }
    
    return { 
      filteredValue: smaFiltered,
      quality
    };
  }
  
  /**
   * New function to detect and reject outliers
   */
  private detectOutlier(value: number): boolean {
    if (this.ppgValues.length < 5) {
      return false;
    }
    
    const recentValues = this.ppgValues.slice(-5);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const stdDev = Math.sqrt(
      recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length
    );
    
    // Reject values that are more than 3 standard deviations from the mean
    // This is a standard statistical outlier detection method
    return Math.abs(value - mean) > (stdDev * 3);
  }
  
  /**
   * Update noise level estimation
   */
  private updateNoiseLevel(rawValue: number, filteredValue: number): void {
    // Noise is estimated as the difference between raw and filtered
    const instantNoise = Math.abs(rawValue - filteredValue);
    
    // Update noise level with exponential smoothing
    this.noiseLevel = 0.1 * instantNoise + 0.9 * this.noiseLevel;
  }
  
  /**
   * Calculate signal quality based on multiple criteria
   * Returns 0-100 quality score
   */
  private calculateSignalQuality(): number {
    // No quality assessment with insufficient data
    if (this.ppgValues.length < 15) { // Increased from 10
      return 30; // Lower default quality
    }
    
    // Factor 1: Noise level (lower is better)
    const noiseScore = Math.max(0, 100 - (this.noiseLevel * 5)); // More strict (was *4)
    
    // Factor 2: Signal stability
    const recentValues = this.ppgValues.slice(-15); // Increased window (was 10)
    const sum = recentValues.reduce((a, b) => a + b, 0);
    const mean = sum / recentValues.length;
    const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
    const stabilityScore = Math.max(0, 100 - Math.min(100, variance / 1.5)); // More strict (was /2)
    
    // Factor 3: Signal range (look for cardiac-like amplitude)
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;
    
    let rangeScore = 0;
    if (range >= this.MIN_REQUIRED_AMPLITUDE && range <= this.MAX_ALLOWED_AMPLITUDE) {
      // Optimal range
      rangeScore = 100;
    } else if (range < this.MIN_REQUIRED_AMPLITUDE) {
      // Too small - likely no finger
      rangeScore = Math.max(0, (range / this.MIN_REQUIRED_AMPLITUDE) * 80);
    } else {
      // Too large - likely motion artifact
      rangeScore = Math.max(0, 100 - ((range - this.MAX_ALLOWED_AMPLITUDE) / 20));
    }
    
    // Factor 4: Pattern consistency (new)
    const patternScore = this.evaluatePatternConsistency(recentValues);
    
    // Weighted average of factors with updated weights
    const quality = Math.round(
      (noiseScore * 0.25) +
      (stabilityScore * 0.3) +
      (rangeScore * 0.25) +
      (patternScore * 0.2)
    );
    
    return Math.min(100, Math.max(0, quality));
  }
  
  /**
   * New function to evaluate pattern consistency
   * Real PPG signals have consistent periodic patterns
   */
  private evaluatePatternConsistency(values: number[]): number {
    if (values.length < 10) {
      return 50;
    }
    
    // Find peaks to analyze pattern
    const peaks = this.findPeaksEnhanced(values);
    
    if (peaks.length < 2) {
      return 30; // Penalize if we can't find clear peaks
    }
    
    // Calculate intervals between peaks
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Calculate interval consistency
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const intervalVariation = intervals.reduce((sum, val) => sum + Math.abs(val - avgInterval), 0) / intervals.length;
    const consistencyRatio = intervalVariation / avgInterval;
    
    // Lower ratio = more consistent
    const consistencyScore = Math.max(0, 100 - (consistencyRatio * 100));
    
    // Check for physiologically reasonable rate
    // Assumes 30 samples/sec and intervals should be between 0.5 and 2 seconds
    // (for heart rates between 30 and 120 bpm)
    const isPhysiological = avgInterval >= 15 && avgInterval <= 60;
    
    return isPhysiological ? consistencyScore : Math.min(60, consistencyScore);
  }
  
  /**
   * Reset the signal processor
   */
  public reset(): void {
    this.ppgValues = [];
    this.noiseLevel = 0;
  }
  
  /**
   * Calculate heart rate from PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    if (this.ppgValues.length < sampleRate * 3) { // Need at least 3 seconds (was 2)
      return 0;
    }
    
    // Get recent data (last 6 seconds) - was 5
    const recentData = this.ppgValues.slice(-Math.min(this.ppgValues.length, sampleRate * 6));
    
    // Find peaks with even more strict criteria
    const peaks = this.findPeaksEnhanced(recentData);
    
    if (peaks.length < 3) { // Require at least 3 peaks (was 2)
      return 0;
    }
    
    // Calculate average interval between peaks
    let totalInterval = 0;
    for (let i = 1; i < peaks.length; i++) {
      totalInterval += peaks[i] - peaks[i - 1];
    }
    
    const avgInterval = totalInterval / (peaks.length - 1);
    
    // Convert to beats per minute
    // interval is in samples, so divide by sample rate to get seconds
    // then convert to minutes (60 seconds/minute)
    return Math.round(60 / (avgInterval / sampleRate));
  }
  
  /**
   * Enhanced peak detection with much stricter criteria
   */
  private findPeaksEnhanced(values: number[]): number[] {
    const peaks: number[] = [];
    const minPeakDistance = 12; // Increased minimum samples between peaks (was 10)
    
    // Calculate mean and standard deviation
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );
    
    // Dynamic threshold based on signal statistics - more strict
    const peakThreshold = mean + (stdDev * 0.7); // Increased from 0.5
    
    // First pass: find potential peaks
    const potentialPeaks = [];
    for (let i = 3; i < values.length - 3; i++) { // Check wider window (was 2)
      const current = values[i];
      
      // Check if this point is higher than neighbors and above threshold
      if (current > values[i - 1] && 
          current > values[i - 2] &&
          current > values[i - 3] &&
          current > values[i + 1] && 
          current > values[i + 2] &&
          current > values[i + 3] &&
          current > peakThreshold) {
        
        potentialPeaks.push(i);
      }
    }
    
    // Second pass: filter peaks by prominence and distance
    for (let i = 0; i < potentialPeaks.length; i++) {
      const peakIdx = potentialPeaks[i];
      const peakValue = values[peakIdx];
      
      // Find nearest valleys to calculate prominence
      let leftValley = mean;
      for (let j = peakIdx - 1; j >= 0; j--) {
        if (values[j] <= values[j + 1]) {
          leftValley = values[j];
          break;
        }
      }
      
      let rightValley = mean;
      for (let j = peakIdx + 1; j < values.length; j++) {
        if (values[j] <= values[j - 1]) {
          rightValley = values[j];
          break;
        }
      }
      
      // Calculate prominence (minimum height above surrounding valleys)
      const prominence = Math.min(peakValue - leftValley, peakValue - rightValley);
      
      // Only accept peaks with sufficient prominence
      if (prominence > stdDev * 0.5) {
        // Check distance from other accepted peaks
        const isFarEnough = peaks.every(p => Math.abs(peakIdx - p) >= minPeakDistance);
        
        if (isFarEnough) {
          peaks.push(peakIdx);
        }
      }
    }
    
    return peaks.sort((a, b) => a - b);
  }
}
