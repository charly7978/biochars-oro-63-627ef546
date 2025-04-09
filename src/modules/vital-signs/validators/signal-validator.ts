
/**
 * Signal validator for vital signs
 */
export class SignalValidator {
  private readonly minAmplitude: number;
  private readonly minDataPoints: number;

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
}
