
/**
 * Validates PPG signal quality
 */
export class SignalValidator {
  private minSignalThreshold: number;
  private minDataPoints: number;
  
  constructor(minSignalThreshold: number = 0.01, minDataPoints: number = 15) {
    this.minSignalThreshold = minSignalThreshold;
    this.minDataPoints = minDataPoints;
  }
  
  /**
   * Check if single signal value is valid (not near zero)
   */
  isValidSignal(value: number): boolean {
    return Math.abs(value) >= this.minSignalThreshold;
  }
  
  /**
   * Check if we have enough data points for processing
   */
  hasEnoughData(values: number[]): boolean {
    return values.length >= this.minDataPoints;
  }
  
  /**
   * Check if signal has sufficient amplitude
   */
  hasValidAmplitude(values: number[]): boolean {
    if (values.length < this.minDataPoints) {
      return false;
    }
    
    const recentValues = values.slice(-this.minDataPoints);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    return amplitude >= this.minSignalThreshold * 10;
  }
  
  /**
   * Log validation results for debugging
   */
  logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    console.log("Signal validation:", {
      isValid,
      amplitude,
      threshold: this.minSignalThreshold * 10,
      recentValues: values.slice(-5)
    });
  }
}
