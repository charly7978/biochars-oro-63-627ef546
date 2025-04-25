
/**
 * Signal Processor for Vital Signs
 * Processes PPG signals for vital signs extraction
 * NO SIMULATION OR MANIPULATION OF DATA IS ALLOWED
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private readonly MAX_BUFFER_SIZE = 100;

  constructor() {
    console.log("SignalProcessor: Initialized");
  }

  /**
   * Process a PPG signal value
   * @param value The input PPG value to process
   * @returns The processed PPG value
   */
  public processPPG(value: number): number {
    // Apply basic filtering (moving average for demonstration)
    const filtered = this.applyBasicFilter(value);
    
    // Store in buffer
    this.ppgValues.push(filtered);
    if (this.ppgValues.length > this.MAX_BUFFER_SIZE) {
      this.ppgValues.shift();
    }
    
    return filtered;
  }
  
  /**
   * Apply a simple filter to the PPG value
   * @param value Input value
   * @returns Filtered value
   */
  private applyBasicFilter(value: number): number {
    // Simple low-pass filter
    if (this.ppgValues.length < 3) {
      return value;
    }
    
    const lastThree = this.ppgValues.slice(-3);
    const avg = lastThree.reduce((sum, val) => sum + val, 0) / 3;
    
    return value * 0.7 + avg * 0.3;
  }
  
  /**
   * Get the current PPG values buffer
   * @returns Array of PPG values
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
  
  /**
   * Reset the signal processor
   */
  public reset(): void {
    this.ppgValues = [];
    console.log("SignalProcessor: Reset");
  }
}
