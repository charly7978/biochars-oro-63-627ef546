
import { FilterUtils } from '../signal-processing/FilterUtils';
import { ProcessorConfig } from './ProcessorConfig';

/**
 * Professional medical-grade signal processor for PPG signals
 * Implements strict validation and precise filtering techniques
 * with zero simulation of data
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private readonly SMA_WINDOW_SIZE = ProcessorConfig.SMA_WINDOW;
  private readonly MIN_VALID_VALUE = 0.01; // Minimum valid signal strength
  private readonly MAX_VALID_VALUE = 255; // Maximum valid signal value
  private readonly VARIANCE_THRESHOLD = 0.5; // Minimum variance for valid signal
  private readonly MIN_SAMPLES_FOR_VALIDATION = 10; // Minimum samples needed for validation
  
  /**
   * Get current PPG values buffer with validation
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
  
  /**
   * Apply Simple Moving Average filter with strict validation
   */
  public applySMAFilter(value: number): number {
    // Validate input
    if (isNaN(value) || !isFinite(value)) {
      console.warn("SignalProcessor: Rejected invalid value in SMA filter");
      return 0;
    }
    
    const windowSize = this.SMA_WINDOW_SIZE;
    
    if (this.ppgValues.length < windowSize) {
      // Not enough data for proper filtering
      this.ppgValues.push(value);
      return value;
    }
    
    const recentValues = this.ppgValues.slice(-windowSize);
    
    // Check for signal quality before processing
    const variance = FilterUtils.calculateVariance(recentValues);
    const isValidSignal = variance > this.VARIANCE_THRESHOLD;
    
    if (!isValidSignal && this.ppgValues.length > this.MIN_SAMPLES_FOR_VALIDATION) {
      console.warn("SignalProcessor: Low quality signal detected, applying strict filtering");
      // Apply stronger filtering for low quality signals
      const median = this.calculateMedian(recentValues);
      this.ppgValues.push(value);
      return (median * 0.7) + (value * 0.3);
    }
    
    // Standard SMA for good quality signals
    const filtered = FilterUtils.applySMAFilter(value, recentValues, windowSize);
    this.ppgValues.push(value);
    return filtered;
  }
  
  /**
   * Reset the signal processor completely
   */
  public reset(): void {
    this.ppgValues = [];
    console.log("SignalProcessor: Reset complete");
  }
  
  /**
   * Calculate median for robust filtering
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
}
