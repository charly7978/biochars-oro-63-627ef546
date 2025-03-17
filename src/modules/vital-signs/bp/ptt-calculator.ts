
/**
 * PTT (Pulse Transit Time) Calculator
 * Handles pulse transit time calculations for blood pressure estimation
 */
export class PTTCalculator {
  /**
   * Calculate weighted PTT value with emphasis on recent measurements
   */
  public static calculateWeightedPTT(pttValues: number[]): number {
    if (pttValues.length === 0) return 600; // Default value
    
    return pttValues.reduce((acc, val, idx) => {
      const weight = (idx + 1) / pttValues.length;
      return acc + val * weight;
    }, 0) / pttValues.reduce((acc, _, idx) => acc + (idx + 1) / pttValues.length, 0);
  }
  
  /**
   * Extract PTT values from peak indices
   */
  public static extractPTTValues(peakIndices: number[], fps: number = 30): number[] {
    const msPerSample = 1000 / fps;
    
    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      pttValues.push(dt);
    }
    
    return pttValues;
  }
  
  /**
   * Normalize PTT to usable range
   */
  public static normalizePTT(weightedPTT: number): number {
    return Math.max(300, Math.min(1200, weightedPTT));
  }
}
