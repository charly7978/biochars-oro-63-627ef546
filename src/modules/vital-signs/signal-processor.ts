
/**
 * Signal Processor for Vital Signs
 * Processes PPG signals for vital signs extraction
 * NO SIMULATION OR MANIPULATION OF DATA IS ALLOWED
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private readonly MAX_BUFFER_SIZE = 100;
  private threshold = 0.15; // Reduced from 0.2
  private baselineValue = 0;

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
    
    // Update baseline with slow adaptation
    if (this.baselineValue === 0) {
      this.baselineValue = filtered;
    } else {
      // More responsive baseline tracking for quicker adaptation
      this.baselineValue = this.baselineValue * 0.97 + filtered * 0.03;
    }
    
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
    
    // More responsive filter (reduced smoothing)
    return value * 0.75 + avg * 0.25;
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
    this.baselineValue = 0;
    console.log("SignalProcessor: Reset");
  }
  
  /**
   * Check for finger presence based on signal characteristics
   * @returns True if a finger is likely present
   */
  public isFingerPresent(): boolean {
    // Need enough samples to determine
    if (this.ppgValues.length < 10) {
      return false;
    }
    
    const recentValues = this.ppgValues.slice(-10);
    
    // 1. Calculate average signal strength
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // 2. Calculate variation between samples
    let variationSum = 0;
    for (let i = 1; i < recentValues.length; i++) {
      const variation = Math.abs(recentValues[i] - recentValues[i-1]);
      variationSum += variation;
    }
    const averageVariation = variationSum / (recentValues.length - 1);
    
    // 3. Decision based on multiple factors:
    //   - Higher variation indicates real cardiac activity (not constant signal)
    //   - Signal should be above a certain absolute minimum
    //   - Variations should not be extremely high (would indicate noise)
    
    const minVariationThreshold = 0.03;  // Reduced minimum variation requirement
    const maxVariationThreshold = 1.2;   // Maximum allowed variation (noise rejection)
    const minSignalThreshold = 0.1;      // Reduced minimum signal requirement
    
    const isFingerPresent = 
      averageVariation > minVariationThreshold &&
      averageVariation < maxVariationThreshold &&
      Math.abs(avg - this.baselineValue) >= minSignalThreshold;
    
    if (isFingerPresent) {
      console.log("Finger presence detected:", {
        avgValue: avg,
        baselineValue: this.baselineValue,
        avgVariation: averageVariation
      });
    }
    
    return isFingerPresent;
  }
}
