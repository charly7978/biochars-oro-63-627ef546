
/**
 * Signal Filter - Contains various filtering methods for PPG signals
 */

export class SignalFilter {
  // Filter parameters
  private readonly SMA_WINDOW_SIZE = 5;
  private readonly EMA_ALPHA = 0.3;
  private readonly MEDIAN_WINDOW_SIZE = 5;
  
  // State variables
  private lastEMA: number | null = null;
  
  /**
   * Apply multiple filtering techniques in sequence
   */
  public applyFilters(value: number, buffer: number[]): number {
    // Apply median filter first to remove outliers
    const medianFiltered = this.applyMedianFilter(value, buffer);
    
    // Apply EMA for smoothing
    const emaFiltered = this.applyEMAFilter(medianFiltered);
    
    // Apply SMA for final smoothing
    return this.applySMAFilter(emaFiltered, buffer);
  }
  
  /**
   * Apply Simple Moving Average filter
   */
  public applySMAFilter(value: number, buffer: number[]): number {
    if (buffer.length < this.SMA_WINDOW_SIZE - 1) {
      return value;
    }
    
    // Create window with recent values plus current value
    const window = [...buffer.slice(-(this.SMA_WINDOW_SIZE - 1)), value];
    
    // Calculate average
    const sum = window.reduce((acc, val) => acc + val, 0);
    return sum / window.length;
  }
  
  /**
   * Apply Exponential Moving Average filter
   */
  public applyEMAFilter(value: number, alpha: number = this.EMA_ALPHA): number {
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
   */
  public applyMedianFilter(value: number, buffer: number[]): number {
    if (buffer.length < this.MEDIAN_WINDOW_SIZE - 1) {
      return value;
    }
    
    // Create window with recent values plus current value
    const window = [...buffer.slice(-(this.MEDIAN_WINDOW_SIZE - 1)), value];
    
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
