
/**
 * Amplitude Calculator
 * Handles signal amplitude calculations for blood pressure estimation
 */
export class AmplitudeCalculator {
  /**
   * Calculate amplitude from peaks and valleys in the signal
   */
  public static calculateAmplitude(
    values: number[],
    peaks: number[],
    valleys: number[]
  ): number {
    if (peaks.length === 0 || valleys.length === 0) return 0;

    const amps: number[] = [];
    const len = Math.min(peaks.length, valleys.length);
    
    for (let i = 0; i < len; i++) {
      const amp = values[peaks[i]] - values[valleys[i]];
      if (amp > 0) {
        amps.push(amp);
      }
    }
    
    if (amps.length === 0) return 0;
    return amps.reduce((a, b) => a + b, 0) / amps.length;
  }
  
  /**
   * Normalize amplitude to a usable range
   */
  public static normalizeAmplitude(amplitude: number): number {
    return Math.min(100, Math.max(0, amplitude * 5));
  }
}
