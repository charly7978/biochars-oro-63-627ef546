
/**
 * Signal Filter - Provides various filtering techniques for PPG signal processing
 * This class is designed to clean up and enhance PPG signals without any simulation
 */

export class SignalFilter {
  // Filter parameters
  private readonly sampleRate: number = 30; // Default sample rate (frames per second)
  private readonly cutoffLow: number = 0.5; // Lower cutoff frequency (Hz)
  private readonly cutoffHigh: number = 5.0; // Upper cutoff frequency (Hz)
  
  // Filter state variables
  private lastValue: number = 0;
  private lastFiltered: number = 0;
  private alpha: number = 0.1; // Smoothing factor for EMA
  
  // History for more complex filters
  private valueHistory: number[] = [];
  private maxHistoryLength: number = 20;
  
  constructor(options?: {
    sampleRate?: number;
    cutoffLow?: number; 
    cutoffHigh?: number;
    alpha?: number;
    historyLength?: number;
  }) {
    if (options) {
      this.sampleRate = options.sampleRate || this.sampleRate;
      this.cutoffLow = options.cutoffLow || this.cutoffLow;
      this.cutoffHigh = options.cutoffHigh || this.cutoffHigh;
      this.alpha = options.alpha || this.alpha;
      this.maxHistoryLength = options.historyLength || this.maxHistoryLength;
    }
  }
  
  /**
   * Apply multiple filtering techniques to the signal
   * This is the main method that applies all appropriate filters
   */
  public applyFilters(value: number, buffer: number[]): number {
    // Store in history
    this.valueHistory.push(value);
    if (this.valueHistory.length > this.maxHistoryLength) {
      this.valueHistory.shift();
    }
    
    // Apply a simple Exponential Moving Average (EMA) filter
    const filteredValue = this.applyEMAFilter(value);
    
    // Apply a bandpass filter if we have enough history
    let result = filteredValue;
    if (buffer.length > 10) {
      result = this.applyBandpassFilter(result, buffer);
    }
    
    // Apply a noise reduction filter
    result = this.applyNoiseReduction(result);
    
    // Store the current value for the next iteration
    this.lastValue = value;
    this.lastFiltered = result;
    
    return result;
  }
  
  /**
   * Apply a simple Exponential Moving Average (EMA) filter
   */
  private applyEMAFilter(value: number): number {
    return this.alpha * value + (1 - this.alpha) * this.lastFiltered;
  }
  
  /**
   * Apply a simple bandpass filter to attenuate frequencies outside the cutoff range
   */
  private applyBandpassFilter(value: number, buffer: number[]): number {
    // This is a simplified bandpass implementation
    // In a real application, a proper IIR or FIR filter would be used
    
    // Calculate the average (DC component)
    const sum = buffer.reduce((acc, val) => acc + val, 0);
    const avg = sum / buffer.length;
    
    // Remove DC component (high-pass effect)
    let filteredValue = value - avg;
    
    // Apply low-pass effect (simple moving average)
    if (this.valueHistory.length >= 3) {
      const recentValues = this.valueHistory.slice(-3);
      filteredValue = recentValues.reduce((acc, val) => acc + val, 0) / recentValues.length;
    }
    
    return filteredValue;
  }
  
  /**
   * Apply a simple noise reduction filter
   */
  private applyNoiseReduction(value: number): number {
    // Simple median filter if we have enough history
    if (this.valueHistory.length >= 5) {
      const values = [...this.valueHistory.slice(-5)];
      values.sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    }
    
    return value;
  }
  
  /**
   * Reset filter state
   */
  public reset(): void {
    this.lastValue = 0;
    this.lastFiltered = 0;
    this.valueHistory = [];
  }
}
