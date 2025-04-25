
/**
 * No-op wavelet filter that passes through raw signal data
 */
export class WaveletDenoiser {
  /**
   * Returns the raw value without any filtering
   * @param value Raw sensor value
   * @returns The same raw value, unmodified
   */
  public denoise(value: number): number {
    return value; // Direct passthrough without Math functions
  }
  
  /**
   * No-op reset function
   */
  public reset(): void {
    // No state to reset
  }
  
  /**
   * No-op threshold setter
   */
  public setThreshold(threshold: number): void {
    // No threshold to set
  }
}
