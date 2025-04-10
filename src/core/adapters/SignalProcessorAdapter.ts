
/**
 * Adapter for signal processing functionality
 * Provides a consistent interface for different signal processing implementations
 */
export class SignalProcessorAdapter {
  private ppgValues: number[] = [];
  private readonly MAX_BUFFER_SIZE = 300;
  
  /**
   * Apply Simple Moving Average filter to the signal
   */
  public applySMAFilter(value: number, windowSize: number = 5): number {
    if (this.ppgValues.length === 0) return value;
    
    const window = Math.min(windowSize, this.ppgValues.length);
    const values = [...this.ppgValues.slice(-window), value];
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }
  
  /**
   * Apply Exponential Moving Average filter to the signal
   */
  public applyEMAFilter(value: number, alpha: number = 0.2): number {
    if (this.ppgValues.length === 0) return value;
    
    const lastValue = this.ppgValues[this.ppgValues.length - 1];
    return alpha * value + (1 - alpha) * lastValue;
  }
  
  /**
   * Apply median filter to the signal
   */
  public applyMedianFilter(value: number, windowSize: number = 5): number {
    if (this.ppgValues.length === 0) return value;
    
    const window = Math.min(windowSize, this.ppgValues.length);
    const values = [...this.ppgValues.slice(-window), value];
    
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  
  /**
   * Apply combined filtering for real signal processing
   */
  public applyFilters(value: number): { filteredValue: number, quality: number } {
    // Step 1: Median filter to remove outliers
    const medianFiltered = this.applyMedianFilter(value);
    
    // Step 2: Low pass filter to smooth the signal
    const lowPassFiltered = this.applyEMAFilter(medianFiltered);
    
    // Step 3: Moving average for final smoothing
    const smaFiltered = this.applySMAFilter(lowPassFiltered);
    
    // Store the filtered value in the buffer
    this.addToPPGValues(smaFiltered);
    
    // Calculate signal quality (simplified)
    const quality = this.calculateSignalQuality();
    
    return { filteredValue: smaFiltered, quality };
  }
  
  /**
   * Add a value to the PPG buffer
   */
  public addToPPGValues(value: number): void {
    this.ppgValues.push(value);
    if (this.ppgValues.length > this.MAX_BUFFER_SIZE) {
      this.ppgValues.shift();
    }
  }
  
  /**
   * Get all PPG values in the buffer
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
  
  /**
   * Calculate signal quality based on recent values
   */
  private calculateSignalQuality(): number {
    if (this.ppgValues.length < 10) return 0;
    
    const recent = this.ppgValues.slice(-10);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const range = max - min;
    
    if (range < 0.01) return 0;
    
    const noiseLevel = this.calculateNoiseLevel(recent);
    const snr = range / Math.max(0.001, noiseLevel);
    
    return Math.min(100, Math.max(0, snr * 50));
  }
  
  /**
   * Calculate noise level in a signal segment
   */
  private calculateNoiseLevel(values: number[]): number {
    if (values.length < 3) return 0;
    
    let sum = 0;
    for (let i = 2; i < values.length; i++) {
      const diff = Math.abs(values[i] - 2 * values[i-1] + values[i-2]);
      sum += diff;
    }
    
    return sum / (values.length - 2);
  }
  
  /**
   * Reset the signal processor
   */
  public reset(): void {
    this.ppgValues = [];
  }
}
