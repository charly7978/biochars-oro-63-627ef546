
/**
 * SignalFilter - Applies various filtering techniques to PPG signals
 * Provides standard filtering methods for noise reduction and feature enhancement
 */

export class SignalFilter {
  private filteredValue: number = 0;
  private prevValue: number = 0;
  private prevFilteredValue: number = 0;
  private alpha: number = 0.3; // EMA filter coefficient
  
  /**
   * Apply multiple filtering techniques to a signal value
   * @param value The raw value to filter
   * @param buffer Optional buffer of recent values for advanced filtering
   * @returns The filtered value
   */
  public applyFilters(value: number, buffer?: number[]): number {
    // Apply simple moving average if buffer is provided
    if (buffer && buffer.length > 5) {
      const window = buffer.slice(-5);
      const sum = window.reduce((a, b) => a + b, 0);
      value = sum / window.length;
    }
    
    // Apply exponential moving average
    this.filteredValue = this.alpha * value + (1 - this.alpha) * this.prevFilteredValue;
    
    // Apply simple derivative filter to remove baseline drift
    if (this.prevValue !== 0) {
      const derivative = this.filteredValue - this.prevFilteredValue;
      // Only apply small corrections to avoid removing important signal features
      this.filteredValue += derivative * 0.2;
    }
    
    // Store values for next iteration
    this.prevValue = value;
    this.prevFilteredValue = this.filteredValue;
    
    return this.filteredValue;
  }
  
  /**
   * Reset filter state
   */
  public reset(): void {
    this.filteredValue = 0;
    this.prevValue = 0;
    this.prevFilteredValue = 0;
  }
  
  /**
   * Set the EMA filter coefficient
   * @param alpha Value between 0 and 1, higher values give more weight to recent samples
   */
  public setAlpha(alpha: number): void {
    if (alpha >= 0 && alpha <= 1) {
      this.alpha = alpha;
    }
  }
  
  /**
   * Apply band-pass filter to the signal
   * Simplified implementation that could be replaced with a proper DSP filter
   * @param value The value to filter
   * @param buffer Buffer of recent values
   * @param lowCutoff Low cutoff frequency in normalized units (0-1)
   * @param highCutoff High cutoff frequency in normalized units (0-1)
   */
  public applyBandPassFilter(
    value: number, 
    buffer: number[], 
    lowCutoff: number = 0.05, 
    highCutoff: number = 0.5
  ): number {
    // This is a very simple implementation
    // In a real application, this would use FFT or proper IIR/FIR filters
    
    if (buffer.length < 10) return value;
    
    // Apply low-pass filter (moving average)
    const maWindow = Math.min(buffer.length, Math.floor(1 / highCutoff));
    const recentValues = buffer.slice(-maWindow);
    const maFiltered = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    
    // Apply high-pass filter (subtract very slow moving average)
    const dcWindow = Math.min(buffer.length, Math.floor(1 / lowCutoff));
    const dcValues = buffer.slice(-dcWindow);
    const dcComponent = dcValues.reduce((a, b) => a + b, 0) / dcValues.length;
    
    return maFiltered - dcComponent;
  }
}
