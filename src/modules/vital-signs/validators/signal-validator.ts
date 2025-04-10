
/**
 * Validator for PPG signals
 */
export class SignalValidator {
  private readonly MIN_AMPLITUDE: number;
  private readonly MIN_DATA_POINTS: number;
  
  /**
   * Create a new signal validator
   */
  constructor(minAmplitude: number = 0.02, minDataPoints: number = 30) {
    this.MIN_AMPLITUDE = minAmplitude;
    this.MIN_DATA_POINTS = minDataPoints;
  }
  
  /**
   * Check if a single signal value is valid (not near zero)
   */
  public isValidSignal(value: number): boolean {
    return Math.abs(value) >= 0.01;
  }
  
  /**
   * Check if we have enough data points for analysis
   */
  public hasEnoughData(values: number[]): boolean {
    return values.length >= this.MIN_DATA_POINTS;
  }
  
  /**
   * Check if signal amplitude is sufficient for analysis
   */
  public hasValidAmplitude(values: number[]): boolean {
    if (values.length < 5) return false;
    
    // Get recent values
    const recentValues = values.slice(-15);
    
    // Calculate min/max
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    
    // Check amplitude
    const amplitude = max - min;
    return amplitude >= this.MIN_AMPLITUDE;
  }
  
  /**
   * Log validation results for debugging
   */
  public logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    console.log("Signal validation results:", {
      isValid,
      amplitude,
      minAmplitudeThreshold: this.MIN_AMPLITUDE,
      dataPoints: values.length,
      minDataPointsThreshold: this.MIN_DATA_POINTS
    });
  }
}
