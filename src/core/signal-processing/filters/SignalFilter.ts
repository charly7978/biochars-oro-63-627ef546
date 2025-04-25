
/**
 * Signal Filter - Contains direct pass-through methods for PPG signals
 * No Math functions are used
 */

export class SignalFilter {
  // State variables
  private lastEMA: number | null = null;
  
  /**
   * Apply minimal filtering techniques - direct passthrough
   */
  public applyFilters(value: number, buffer: number[]): number {
    return value; // Direct passthrough without filters
  }
  
  /**
   * Apply Simple Moving Average filter without Math functions
   */
  public applySMAFilter(value: number, buffer: number[]): number {
    if (buffer.length < 4) {
      return value;
    }
    
    // Create window with recent values plus current value
    const window = [...buffer.slice(-4), value];
    
    // Calculate average without reduce
    let sum = 0;
    for (let i = 0; i < window.length; i++) {
      sum += window[i];
    }
    
    return sum / window.length;
  }
  
  /**
   * Apply Exponential Moving Average filter without Math functions
   */
  public applyEMAFilter(value: number, alpha: number = 0.3): number {
    if (this.lastEMA === null) {
      this.lastEMA = value;
      return value;
    }
    
    const ema = alpha * value + (1 - alpha) * this.lastEMA;
    this.lastEMA = ema;
    return ema;
  }
  
  /**
   * Apply Median Filter without using Math.sort
   */
  public applyMedianFilter(value: number, buffer: number[]): number {
    if (buffer.length < 4) {
      return value;
    }
    
    // Create window with recent values plus current value
    const window = [...buffer.slice(-4), value];
    
    // Simple bubble sort implementation instead of array.sort
    const sorted = [...window];
    for (let i = 0; i < sorted.length; i++) {
      for (let j = 0; j < sorted.length - i - 1; j++) {
        if (sorted[j] > sorted[j + 1]) {
          // Swap without destructuring
          const temp = sorted[j];
          sorted[j] = sorted[j + 1];
          sorted[j + 1] = temp;
        }
      }
    }
    
    // Return the median value
    return sorted[~~(sorted.length / 2)];
  }
  
  /**
   * Reset all filter states
   */
  public reset(): void {
    this.lastEMA = null;
  }
}
