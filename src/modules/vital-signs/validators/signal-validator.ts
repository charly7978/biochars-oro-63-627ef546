
/**
 * Validates signal quality and characteristics
 * Ensures signal is appropriate for vital signs processing
 */
export class SignalValidator {
  private readonly amplitudeThreshold: number;
  private readonly minRequiredPoints: number;
  private readonly signalThreshold: number = 0.05;
  
  // State tracking for finger detection patterns
  private signalBuffer: number[] = [];
  private readonly patternBufferSize: number = 20;
  private readonly minPeaksForFingerDetection: number = 4;
  private consecutivePatternMatches: number = 0;
  private readonly requiredConsecutiveMatches: number = 3;
  
  constructor(amplitudeThreshold: number = 0.01, minRequiredPoints: number = 10) {
    this.amplitudeThreshold = amplitudeThreshold;
    this.minRequiredPoints = minRequiredPoints;
  }
  
  /**
   * Validates if a signal value is above threshold
   */
  public isValidSignal(value: number): boolean {
    return Math.abs(value) >= this.signalThreshold;
  }
  
  /**
   * Validates if enough data points for processing
   */
  public hasEnoughData(values: number[]): boolean {
    return values.length >= this.minRequiredPoints;
  }
  
  /**
   * Validates if signal amplitude is sufficient
   */
  public hasValidAmplitude(values: number[]): boolean {
    if (values.length < 5) return false;
    
    const recentValues = values.slice(-10);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    return amplitude >= this.amplitudeThreshold;
  }
  
  /**
   * Track signal for pattern-based finger detection
   * Updates internal buffer and pattern analysis
   */
  public trackSignalForPatternDetection(value: number): void {
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.patternBufferSize) {
      this.signalBuffer.shift();
    }
  }
  
  /**
   * Detect finger presence using pattern recognition
   * Identifies physiological patterns in the signal
   */
  public isFingerDetectedByPattern(): boolean {
    if (this.signalBuffer.length < this.patternBufferSize) {
      return false;
    }
    
    // Find peaks to detect heartbeat pattern
    const peaks = this.detectPeaks(this.signalBuffer);
    
    // Check if we have sufficient peaks for analysis
    if (peaks.length >= this.minPeaksForFingerDetection) {
      // Calculate intervals between peaks
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i-1]);
      }
      
      // Check for physiologically plausible intervals
      const isRegular = this.areIntervalsRegular(intervals);
      
      if (isRegular) {
        this.consecutivePatternMatches = Math.min(10, this.consecutivePatternMatches + 1);
      } else {
        this.consecutivePatternMatches = Math.max(0, this.consecutivePatternMatches - 1);
      }
      
      return this.consecutivePatternMatches >= this.requiredConsecutiveMatches;
    }
    
    // Gradually decrease matches count if no pattern found
    this.consecutivePatternMatches = Math.max(0, this.consecutivePatternMatches - 0.5);
    return this.consecutivePatternMatches >= this.requiredConsecutiveMatches;
  }
  
  /**
   * Check if finger is detected by combining amplitude and pattern
   */
  public isFingerDetected(): boolean {
    return this.hasValidAmplitude(this.signalBuffer) && this.isFingerDetectedByPattern();
  }
  
  /**
   * Reset finger detection state
   */
  public resetFingerDetection(): void {
    this.signalBuffer = [];
    this.consecutivePatternMatches = 0;
  }
  
  /**
   * Detect peaks in signal values
   */
  private detectPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    
    // Simple peak detection algorithm
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Check if intervals between peaks are regular (physiological)
   */
  private areIntervalsRegular(intervals: number[]): boolean {
    if (intervals.length < 2) return false;
    
    // Calculate mean and standard deviation
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Check physiological plausibility (typical heart rate range)
    if (mean < 3 || mean > 20) { // For typical sampling rate, corresponds to ~30-200 BPM
      return false;
    }
    
    // Calculate variance
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Coefficient of variation as measure of regularity
    const cv = stdDev / mean;
    
    // Consider regular if CV is below threshold
    return cv < 0.3; // 30% variation allowed
  }
  
  /**
   * Log validation results for debugging
   */
  public logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    const recentValues = values.slice(-10);
    console.log("SignalValidator: Validation result", {
      isValid,
      amplitude,
      threshold: this.amplitudeThreshold,
      recentValues,
      hasPeaks: this.detectPeaks(recentValues).length > 1
    });
  }
}
