
/**
 * Signal processor for PPG signal
 */
export class SignalProcessor {
  private ppgValues: number[] = [];
  private smaBuffer: number[] = [];
  private readonly SMA_WINDOW = 3;

  /**
   * Apply Simple Moving Average filter to PPG signal
   */
  public applySMAFilter(value: number): number {
    this.smaBuffer.push(value);
    if (this.smaBuffer.length > this.SMA_WINDOW) {
      this.smaBuffer.shift();
    }
    const sum = this.smaBuffer.reduce((a, b) => a + b, 0);
    return sum / this.smaBuffer.length;
  }

  /**
   * Get stored PPG values
   */
  public getPPGValues(): number[] {
    return this.ppgValues;
  }

  /**
   * Reset the processor
   */
  public reset(): void {
    this.ppgValues = [];
    this.smaBuffer = [];
  }
}
