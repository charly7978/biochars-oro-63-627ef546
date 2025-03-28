
/**
 * Signal processor for PPG signals
 * Implements various filtering and analysis techniques
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private readonly SMA_WINDOW_SIZE = 3;
  
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
  public applyEMAFilter(value: number, alpha: number = 0.3): number {
    if (this.ppgValues.length === 0) {
      return value;
    }
    
    const lastValue = this.ppgValues[this.ppgValues.length - 1];
    return alpha * value + (1 - alpha) * lastValue;
  }
  
  /**
   * Reset the signal processor
   */
  public reset(): void {
    this.ppgValues = [];
  }
  
  /**
   * Calculate heart rate from PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    if (this.ppgValues.length < sampleRate * 2) {
      return 0; // Need at least 2 seconds of data
    }
    
    // Get recent data (last 5 seconds)
    const recentData = this.ppgValues.slice(-Math.min(this.ppgValues.length, sampleRate * 5));
    
    // Find peaks
    const peaks = this.findPeaks(recentData);
    
    if (peaks.length < 2) {
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
   * Find peaks in signal
   */
  private findPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    
    // Simple peak detector
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
}
