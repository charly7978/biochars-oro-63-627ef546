
/**
 * Direct signal pass-through without any manipulation
 */
export class WaveletDenoiser {
  public denoise(value: number): number {
    return value;
  }
  
  public reset(): void {}
  
  public setThreshold(_threshold: number): void {}
}
