
/**
 * Processes RR interval data for arrhythmia detection
 */
export class RRDataProcessor {
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  
  /**
   * Update RR data
   */
  public updateRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): boolean {
    if (!rrData?.intervals || rrData.intervals.length === 0) {
      return false;
    }
    
    this.rrIntervals = rrData.intervals;
    this.lastPeakTime = rrData.lastPeakTime;
    
    return this.rrIntervals.length >= 12;
  }
  
  /**
   * Get current RR intervals
   */
  public getRRIntervals(): number[] {
    return this.rrIntervals;
  }
  
  /**
   * Get last peak time
   */
  public getLastPeakTime(): number | null {
    return this.lastPeakTime;
  }
  
  /**
   * Reset RR data
   */
  public reset(): void {
    this.rrIntervals = [];
    this.lastPeakTime = null;
  }
}
