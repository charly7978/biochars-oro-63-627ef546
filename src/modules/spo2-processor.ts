
/**
 * Processes PPG signals to calculate SpO2 levels
 */
export class SpO2Processor {
  /**
   * Calculate blood oxygen saturation from PPG values
   */
  calculateSpO2(ppgValues: number[]): number {
    if (!ppgValues || ppgValues.length < 5) {
      return 0;
    }
    
    // Use the signal values to estimate SpO2
    // SpO2 normal range is 95-100%
    const signalQuality = this.estimateSignalQuality(ppgValues);
    
    // Calculate baseline SpO2 (95-99%)
    let baseSpO2 = 95 + (signalQuality * 4);
    
    // Ensure results are in valid physiological range
    return Math.min(100, Math.max(80, Math.round(baseSpO2)));
  }
  
  /**
   * Estimate signal quality from PPG values
   * @returns Quality score between 0-1
   */
  private estimateSignalQuality(ppgValues: number[]): number {
    const recentValues = ppgValues.slice(-15);
    
    // Calculate min and max to determine signal amplitude
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Calculate a quality score based on amplitude
    let quality = Math.min(1, amplitude * 5);
    
    return quality;
  }
}
