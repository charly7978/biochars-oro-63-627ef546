
/**
 * Arrhythmia detection service
 */

export interface ArrhythmiaDetectionResult {
  isArrhythmia: boolean;
  arrhythmiaStatus: string;
  confidence: number;
  timestamp: number;
  rmssd: number;
  rrVariation: number;
}

export class ArrhythmiaDetectionService {
  private arrhythmiaCounter: number = 0;
  
  /**
   * Detect arrhythmias from RR interval data
   */
  public detectArrhythmia(rrData: { intervals: number[], lastPeakTime: number | null }): ArrhythmiaDetectionResult {
    if (!rrData || !rrData.intervals || rrData.intervals.length < 3) {
      return {
        isArrhythmia: false,
        arrhythmiaStatus: "--",
        confidence: 0,
        timestamp: Date.now(),
        rmssd: 0,
        rrVariation: 0
      };
    }
    
    // Calculate heart rate variability
    const rmssd = this.calculateRMSSD(rrData.intervals);
    const variation = this.calculateRRVariation(rrData.intervals);
    
    // Detect arrhythmia based on variability
    let isArrhythmia = false;
    let confidence = 0;
    
    if (variation > 0.15 && rmssd > 100) {
      isArrhythmia = true;
      this.arrhythmiaCounter++;
      confidence = Math.min(0.95, Math.max(0.6, variation * 2));
    }
    
    return {
      isArrhythmia,
      arrhythmiaStatus: isArrhythmia ? `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}` : `NORMAL|${this.arrhythmiaCounter}`,
      confidence,
      timestamp: rrData.lastPeakTime || Date.now(),
      rmssd,
      rrVariation: variation
    };
  }
  
  /**
   * Calculate RMSSD (Root Mean Square of Successive Differences)
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sum = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sum += diff * diff;
    }
    
    return Math.sqrt(sum / (intervals.length - 1));
  }
  
  /**
   * Calculate RR variation coefficient
   */
  private calculateRRVariation(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const sumSquares = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
    const std = Math.sqrt(sumSquares / intervals.length);
    
    return std / mean; // Coefficient of variation
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Reset arrhythmia counter
   */
  public reset(): void {
    this.arrhythmiaCounter = 0;
  }
}
