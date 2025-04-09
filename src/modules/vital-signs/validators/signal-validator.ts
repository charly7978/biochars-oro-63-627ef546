/**
 * Signal validator for vital signs
 */
export class SignalValidator {
  private readonly minAmplitude: number;
  private readonly minDataPoints: number;
  private signalHistory: number[] = [];
  private patternDetected: boolean = false;
  private lastDetectionTime: number = 0;

  constructor(minAmplitude: number = 0.01, minDataPoints: number = 15) {
    this.minAmplitude = minAmplitude;
    this.minDataPoints = minDataPoints;
  }

  /**
   * Check if signal is valid (non-zero, not too weak)
   */
  public isValidSignal(value: number): boolean {
    return Math.abs(value) >= 0.001;
  }

  /**
   * Check if we have enough data points to process
   */
  public hasEnoughData(values: number[]): boolean {
    return values.length >= this.minDataPoints;
  }

  /**
   * Check if signal amplitude is sufficient
   */
  public hasValidAmplitude(values: number[]): boolean {
    if (values.length < 3) return false;
    
    const recentValues = values.slice(-Math.min(values.length, 15));
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    return amplitude >= this.minAmplitude;
  }

  /**
   * Log validation results for debugging
   */
  public logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    console.log("SignalValidator: Validation results", {
      isValid,
      amplitude,
      minAmplitude: this.minAmplitude,
      minDataPoints: this.minDataPoints,
      dataPoints: values.length
    });
  }

  /**
   * Validate signal from multiple metrics
   */
  public validateSignal(signal: number): boolean {
    return Math.abs(signal) >= 0.001;
  }

  /**
   * Track signal for pattern detection
   */
  public trackSignalForPatternDetection(value: number): void {
    this.signalHistory.push(value);
    
    // Keep history limited
    if (this.signalHistory.length > 30) {
      this.signalHistory.shift();
    }
    
    // Check for patterns that might indicate finger presence
    if (this.signalHistory.length >= 10) {
      // Simple pattern detection algorithm
      const recentValues = this.signalHistory.slice(-10);
      let crossings = 0;
      
      for (let i = 1; i < recentValues.length; i++) {
        if ((recentValues[i] > 0 && recentValues[i-1] <= 0) || 
            (recentValues[i] < 0 && recentValues[i-1] >= 0)) {
          crossings++;
        }
      }
      
      // If we detect reasonable zero-crossings (indicating a rhythmic pattern)
      if (crossings >= 2 && crossings <= 5) {
        this.patternDetected = true;
        this.lastDetectionTime = Date.now();
      } else if (Date.now() - this.lastDetectionTime > 3000) {
        // Reset if no pattern detected for some time
        this.patternDetected = false;
      }
    }
  }
  
  /**
   * Check if finger is detected based on signal pattern
   */
  public isFingerDetected(): boolean {
    return this.patternDetected;
  }
  
  /**
   * Reset finger detection state
   */
  public resetFingerDetection(): void {
    this.patternDetected = false;
    this.signalHistory = [];
    this.lastDetectionTime = 0;
  }
}
