
/**
 * Arrhythmia Processor - Detects heart rhythm irregularities
 */
export class ArrhythmiaProcessor {
  private arrhythmiaCount: number = 0;
  
  /**
   * Process RR interval data to detect arrhythmias
   */
  public processRRData(rrData: { 
    intervals: number[]; 
    lastPeakTime: number | null 
  }): { 
    arrhythmiaStatus: string; 
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number } | null 
  } {
    if (!rrData || !rrData.intervals || rrData.intervals.length < 4) {
      return { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    }
    
    // Get the last few RR intervals to analyze
    const intervals = rrData.intervals.slice(-8);
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    let sumSquaredDiff = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / (intervals.length - 1));
    
    // Calculate variation as percentage of average interval
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const rrVariation = rmssd / avgInterval;
    
    // Detect arrhythmia based on threshold
    const isArrhythmia = rrVariation > 0.15; // Threshold for considering arrhythmia
    
    let arrhythmiaStatus = "--";
    let lastArrhythmiaData = null;
    
    if (isArrhythmia) {
      this.arrhythmiaCount++;
      arrhythmiaStatus = "ARRITMIA DETECTADA";
      
      // Create arrhythmia data for visualization
      lastArrhythmiaData = {
        timestamp: rrData.lastPeakTime || Date.now(),
        rmssd,
        rrVariation
      };
    }
    
    return { arrhythmiaStatus, lastArrhythmiaData };
  }
  
  /**
   * Get the total count of detected arrhythmias
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Reset the arrhythmia counter
   */
  public reset(): void {
    this.arrhythmiaCount = 0;
  }
}
