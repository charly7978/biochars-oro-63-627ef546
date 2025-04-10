
/**
 * Signal Processor for PPG signals
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private readonly FILTER_WINDOW_SIZE = 5;
  private isInitialized: boolean = false;
  
  // Add custom properties for callbacks
  public onSignalReady?: (signal: any) => void;
  public onError?: (error: any) => void;
  
  /**
   * Initialize the processor
   */
  public async initialize(): Promise<void> {
    console.log("SignalProcessor: Initializing");
    this.isInitialized = true;
    return Promise.resolve();
  }
  
  /**
   * Start processing
   */
  public start(): void {
    console.log("SignalProcessor: Starting processing");
  }
  
  /**
   * Stop processing
   */
  public stop(): void {
    console.log("SignalProcessor: Stopping processing");
    this.reset();
  }
  
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
    const filtered = sum / this.FILTER_WINDOW_SIZE;
    
    // Dispatch signal if callback is set
    if (this.onSignalReady) {
      this.onSignalReady({
        timestamp: Date.now(),
        rawValue: value,
        filteredValue: filtered,
        quality: this.calculateSignalQuality(),
        fingerDetected: true,
        roi: null
      });
    }
    
    return filtered;
  }
  
  /**
   * Calculate signal quality based on variance and range
   */
  private calculateSignalQuality(): number {
    if (this.ppgValues.length < 10) return 0;
    
    const recentValues = this.ppgValues.slice(-30);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;
    
    // Calculate average and standard deviation
    const sum = recentValues.reduce((a, b) => a + b, 0);
    const avg = sum / recentValues.length;
    
    let varianceSum = 0;
    for (const value of recentValues) {
      varianceSum += Math.pow(value - avg, 2);
    }
    const stdDev = Math.sqrt(varianceSum / recentValues.length);
    
    // Calculate quality based on range and stability
    const rangeQuality = Math.min(100, range * 20);
    const stabilityQuality = Math.max(0, 100 - (stdDev / avg) * 200);
    
    // Combined quality score
    return Math.min(100, (rangeQuality * 0.4) + (stabilityQuality * 0.6));
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
