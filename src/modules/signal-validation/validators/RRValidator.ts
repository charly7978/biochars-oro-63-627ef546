
/**
 * Specialized validator for RR interval data
 */
export class RRValidator {
  /**
   * Validate RR interval data for arrhythmia analysis
   */
  public validateRRIntervals(rrData?: { intervals: number[]; lastPeakTime: number | null }): boolean {
    if (!rrData) return false;
    
    // Verify that we have sufficient intervals
    if (rrData.intervals.length < 8) {
      return false;
    }
    
    // Verify physiological plausibility of intervals
    const hasInvalidIntervals = rrData.intervals.some(interval => 
      isNaN(interval) || !isFinite(interval) || interval <= 300 || interval > 1800);
    
    if (hasInvalidIntervals) {
      return false;
    }
    
    // Verify plausible heart rate
    if (rrData.intervals.length > 0) {
      const averageRR = rrData.intervals.reduce((sum, val) => sum + val, 0) / rrData.intervals.length;
      const approximateBPM = 60000 / averageRR;
      
      if (approximateBPM < 40 || approximateBPM > 180) {
        return false;
      }
    }
    
    // Verify reasonable interval variability
    if (rrData.intervals.length >= 3) {
      const variations = [];
      for (let i = 1; i < rrData.intervals.length; i++) {
        variations.push(Math.abs(rrData.intervals[i] - rrData.intervals[i-1]));
      }
      
      const maxVariation = Math.max(...variations);
      const avgVariation = variations.reduce((sum, v) => sum + v, 0) / variations.length;
      
      // Reject extreme variations
      if (maxVariation > 5 * avgVariation) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Reset RR validator state
   */
  public reset(): void {
    // No state to reset
  }
}
