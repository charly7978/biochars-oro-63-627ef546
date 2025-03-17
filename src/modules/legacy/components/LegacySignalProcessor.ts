
/**
 * Legacy signal processor component
 * Handles filtering and buffering of PPG signals
 */

import { ProcessorConfig } from '../../vital-signs/ProcessorConfig';

export class LegacySignalProcessor {
  private ppgValues: number[] = [];
  private smaBuffer: number[] = [];
  
  /**
   * Apply Simple Moving Average filter to smooth the signal
   */
  public applySMAFilter(value: number): number {
    this.smaBuffer.push(value);
    if (this.smaBuffer.length > ProcessorConfig.SMA_WINDOW) {
      this.smaBuffer.shift();
    }
    const sum = this.smaBuffer.reduce((a, b) => a + b, 0);
    return sum / this.smaBuffer.length;
  }

  /**
   * Update the PPG values buffer with a new filtered value
   */
  public updatePPGValues(filteredValue: number): void {
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > ProcessorConfig.WINDOW_SIZE) {
      this.ppgValues.shift();
    }
  }
  
  /**
   * Get the current PPG values buffer
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }
  
  /**
   * Reset the signal processor state
   */
  public reset(): void {
    this.ppgValues = [];
    this.smaBuffer = [];
  }
}
