/**
 * Signal Filter - Contains various filtering methods for PPG signals
 */

export class SignalFilter {
  // State variables
  private lastEMA: number | null = null;
  
  /**
   * Apply multiple filtering techniques in sequence
   * Note: This combined method might be less useful now, consider removing or adapting.
   * Keeping for now, but using default parameters might be necessary if kept.
   */
  public applyFilters(value: number, buffer: number[], smaWindow: number = 5, medianWindow: number = 5, emaAlpha: number = 0.3): number {
    // Apply median filter first to remove outliers
    // Need buffer slicing logic here if buffer is passed directly
    const medianWindowSlice = buffer.length >= medianWindow - 1 ? buffer.slice(-(medianWindow - 1)) : [];
    const medianFiltered = this.applyMedianFilter(value, medianWindowSlice, medianWindow);
    
    // Apply EMA for smoothing
    const emaFiltered = this.applyEMAFilter(medianFiltered, emaAlpha);
    
    // Apply SMA for final smoothing
    // Need buffer slicing logic here if buffer is passed directly
    const smaWindowSlice = buffer.length >= smaWindow - 1 ? buffer.slice(-(smaWindow - 1)) : [];
    return this.applySMAFilter(emaFiltered, smaWindowSlice, smaWindow);
  }
  
  /**
   * Apply Simple Moving Average filter
   * @param value The current raw value.
   * @param recentBuffer A buffer containing the last (windowSize - 1) values.
   * @param windowSize The total size of the moving average window.
   */
  public applySMAFilter(value: number, recentBuffer: number[], windowSize: number): number {
    if (recentBuffer.length < windowSize - 1) {
      // Not enough data for a full window yet, maybe return current value or partial average
      // Returning value for simplicity, might need adjustment based on usage
      return value;
    }
    
    // Create window with recent values plus current value
    const window = [...recentBuffer, value];
    
    // Calculate average
    const sum = window.reduce((acc, val) => acc + val, 0);
    return sum / window.length; // window.length should equal windowSize here
  }
  
  /**
   * Apply Exponential Moving Average filter
   * @param value The current raw value.
   * @param alpha The smoothing factor (0 < alpha <= 1).
   */
  public applyEMAFilter(value: number, alpha: number): number {
    if (alpha <= 0 || alpha > 1) {
      console.warn("EMA alpha must be between 0 and 1. Using value directly.");
      return value;
    }
    if (this.lastEMA === null) {
      this.lastEMA = value;
      return value;
    }
    
    const ema = alpha * value + (1 - alpha) * this.lastEMA;
    this.lastEMA = ema;
    return ema;
  }
  
  /**
   * Apply Median Filter to remove outliers
   * @param value The current raw value.
   * @param recentBuffer A buffer containing the last (windowSize - 1) values.
   * @param windowSize The total size of the median filter window (should be odd).
   */
  public applyMedianFilter(value: number, recentBuffer: number[], windowSize: number): number {
    if (windowSize % 2 === 0) {
      console.warn("Median filter window size should be odd. Incrementing size by 1.");
      windowSize++;
    }
    if (recentBuffer.length < windowSize - 1) {
      // Not enough data for a full window yet
      return value;
    }
    
    // Create window with recent values plus current value
    const window = [...recentBuffer, value];
    
    // Sort the window
    const sorted = [...window].sort((a, b) => a - b);
    
    // Return the median value
    return sorted[Math.floor(sorted.length / 2)];
  }
  
  /**
   * Reset all filter states
   */
  public reset(): void {
    this.lastEMA = null;
  }
}
