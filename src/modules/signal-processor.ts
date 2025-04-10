
/**
 * Processor for PPG signal filtering and analysis
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private readonly SMA_WINDOW_SIZE = 5;
  
  /**
   * Apply Simple Moving Average filter to smooth signals
   */
  applySMAFilter(value: number): number {
    this.ppgValues.push(value);
    
    // Limit buffer size
    if (this.ppgValues.length > 300) {
      this.ppgValues.shift();
    }
    
    // Apply SMA if we have enough values
    if (this.ppgValues.length < this.SMA_WINDOW_SIZE) {
      return value;
    }
    
    // Calculate moving average
    const window = this.ppgValues.slice(-this.SMA_WINDOW_SIZE);
    const sum = window.reduce((acc, val) => acc + val, 0);
    return sum / this.SMA_WINDOW_SIZE;
  }
  
  /**
   * Get all stored PPG values
   */
  getPPGValues(): number[] {
    return [...this.ppgValues];
  }
  
  /**
   * Reset the processor state
   */
  reset(): void {
    this.ppgValues = [];
  }
}
