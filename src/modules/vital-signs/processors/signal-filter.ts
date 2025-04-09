
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Enhanced signal filtering utilities for processing real PPG signals
 * All methods work with real data only, no simulation
 */
export class SignalFilter {
  // Improved filter parameters for better signal quality
  private readonly SMA_WINDOW_SIZE = 8;          // Increased from 5 for smoother output
  private readonly MEDIAN_WINDOW_SIZE = 5;       // Increased from 3 for better outlier rejection
  private readonly LOW_PASS_ALPHA = 0.15;        // Reduced from 0.2 for more aggressive filtering
  private readonly HIGH_PASS_ALPHA = 0.85;       // Added high-pass filter parameter
  
  // Buffer for advanced filtering techniques
  private medianBuffer: number[] = [];
  private emaValue: number | null = null;
  private lastValues: number[] = [];
  
  /**
   * Apply Moving Average filter to real values with improved window size
   */
  public applySMAFilter(value: number, values: number[]): number {
    const windowSize = this.SMA_WINDOW_SIZE;
    
    if (values.length < windowSize) {
      return value;
    }
    
    const recentValues = values.slice(-windowSize);
    const sum = recentValues.reduce((acc, val) => acc + val, 0);
    return (sum + value) / (windowSize + 1);
  }
  
  /**
   * Apply Exponential Moving Average filter to real data
   * with improved alpha parameter for smoother output
   */
  public applyEMAFilter(value: number, values: number[], alpha: number = this.LOW_PASS_ALPHA): number {
    if (values.length === 0) {
      return value;
    }
    
    if (this.emaValue === null) {
      this.emaValue = value;
      return value;
    }
    
    this.emaValue = alpha * value + (1 - alpha) * this.emaValue;
    return this.emaValue;
  }
  
  /**
   * Apply median filter to real data with improved window size
   * for better outlier rejection
   */
  public applyMedianFilter(value: number, values: number[]): number {
    // Update internal buffer for better continuity
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.MEDIAN_WINDOW_SIZE) {
      this.medianBuffer.shift();
    }
    
    // If buffer is not full, use existing values plus current value
    if (this.medianBuffer.length < this.MEDIAN_WINDOW_SIZE) {
      const availableValues = [...values.slice(-this.MEDIAN_WINDOW_SIZE + 1), value];
      availableValues.sort((a, b) => a - b);
      return availableValues[Math.floor(availableValues.length / 2)];
    }
    
    // Create a copy for sorting to avoid mutating the buffer
    const valuesForMedian = [...this.medianBuffer];
    valuesForMedian.sort((a, b) => a - b);
    
    return valuesForMedian[Math.floor(valuesForMedian.length / 2)];
  }
  
  /**
   * Apply bandpass filter to real data - combines low and high pass filtering
   * to remove both high-frequency noise and baseline wander
   */
  public applyBandpassFilter(value: number, values: number[]): number {
    if (values.length === 0) {
      this.lastValues = [value];
      return value;
    }
    
    // First apply low-pass filter to remove high-frequency noise
    const lowPassFiltered = this.applyEMAFilter(value, values, this.LOW_PASS_ALPHA);
    
    // Then apply high-pass filter to remove baseline wander
    // Store the last few low-pass filtered values
    this.lastValues.push(lowPassFiltered);
    if (this.lastValues.length > 10) {
      this.lastValues.shift();
    }
    
    // Calculate baseline as moving average of low-pass filtered signal
    const baseline = this.lastValues.reduce((sum, val) => sum + val, 0) / this.lastValues.length;
    
    // Remove baseline to get high-pass filtered signal
    return lowPassFiltered - baseline * (1 - this.HIGH_PASS_ALPHA);
  }
  
  /**
   * Apply combined filtering approach for optimal PPG signal quality
   * This uses a pipeline of filters to progressively clean the signal
   */
  public applyOptimalFilter(value: number, values: number[]): number {
    // Step 1: Apply median filter to remove sudden spikes/outliers
    const medianFiltered = this.applyMedianFilter(value, values);
    
    // Step 2: Apply bandpass filter to remove both high and low frequency noise
    const bandpassFiltered = this.applyBandpassFilter(medianFiltered, values);
    
    // Step 3: Final smoothing with SMA for presentation
    const finalValue = this.applySMAFilter(bandpassFiltered, values);
    
    return finalValue;
  }
  
  /**
   * Reset all internal filter states
   */
  public reset(): void {
    this.medianBuffer = [];
    this.emaValue = null;
    this.lastValues = [];
  }
}
