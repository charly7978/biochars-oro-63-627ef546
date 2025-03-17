
import { FilterUtils } from '../signal-processing/FilterUtils';
import { ProcessorConfig } from './ProcessorConfig';

/**
 * Signal processor for PPG signals
 * Implements validation and filtering techniques
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private smaBuffer: number[] = [];
  
  /**
   * Get current PPG values buffer
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
  
  /**
   * Apply Simple Moving Average filter
   */
  public applySMAFilter(value: number): number {
    this.smaBuffer.push(value);
    if (this.smaBuffer.length > ProcessorConfig.SMA_WINDOW) {
      this.smaBuffer.shift();
    }
    const sum = this.smaBuffer.reduce((a, b) => a + b, 0);
    const filtered = sum / this.smaBuffer.length;
    
    this.ppgValues.push(filtered);
    if (this.ppgValues.length > ProcessorConfig.WINDOW_SIZE) {
      this.ppgValues.shift();
    }
    
    return filtered;
  }
  
  /**
   * Reset the signal processor completely
   */
  public reset(): void {
    this.ppgValues = [];
    this.smaBuffer = [];
    console.log("SignalProcessor: Reset complete");
  }
}
