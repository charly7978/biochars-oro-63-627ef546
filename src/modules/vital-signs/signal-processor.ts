
/**
 * Signal Processor for PPG signals
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private readonly FILTER_WINDOW_SIZE = 5;
  
  // Add custom properties for callbacks
  public onSignalReady?: (signal: any) => void;
  public onError?: (error: any) => void;
  
  /**
   * Apply Simple Moving Average filter to smooth signal
   */
  public applySMAFilter(value: number): number {
    this.ppgValues.push(value);
    
    // Limit buffer size
    if (this.ppgValues.length > 300) {
      this.ppgValues.shift();
    }
    
    // Calculate SMA if we have enough values
    if (this.ppgValues.length < this.FILTER_WINDOW_SIZE) {
      return value;
    }
    
    // Get the last few values for the window
    const window = this.ppgValues.slice(-this.FILTER_WINDOW_SIZE);
    
    // Calculate average
    const sum = window.reduce((a, b) => a + b, 0);
    return sum / this.FILTER_WINDOW_SIZE;
  }
  
  /**
   * Get current PPG values buffer
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
  
  /**
   * Reset the processor
   */
  public reset(): void {
    this.ppgValues = [];
  }
}
