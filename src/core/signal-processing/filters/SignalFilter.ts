
/**
 * Signal Filter - Contains direct pass-through methods for PPG signals
 * No Math functions are used
 */

export class SignalFilter {
  private lastEMA: number | null = null;
  
  /**
   * Apply minimal filtering techniques - direct passthrough
   */
  public applyFilters(value: number): number {
    return value; // Direct passthrough without filters
  }
  
  /**
   * Apply Simple Moving Average filter without Math functions
   */
  public applySMAFilter(value: number, buffer: number[]): number {
    if (buffer.length < 4) return value;
    
    const window = [...buffer.slice(-4), value];
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
   * Reset filter states
   */
  public reset(): void {
    this.lastEMA = null;
  }
}
