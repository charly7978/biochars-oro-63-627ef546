
/**
 * Processor for detecting cardiac arrhythmias from RR intervals
 */
export class ArrhythmiaProcessor {
  /**
   * Process RR interval data to detect potential arrhythmias
   */
  processRRData(rrData: { 
    intervals: number[]; 
    lastPeakTime: number | null 
  }): { 
    arrhythmiaStatus: string; 
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number } | null 
  } {
    if (!rrData || !rrData.intervals || rrData.intervals.length < 3) {
      return { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    }
    
    // Get the last several RR intervals
    const intervals = rrData.intervals.slice(-8);
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    let sumSquaredDiff = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / (intervals.length - 1));
    
    // Calculate mean RR interval
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Calculate variation as percentage of mean
    const rrVariation = (rmssd / mean) * 100;
    
    // Determine if this represents an arrhythmia
    // Typically, variation >15% may indicate arrhythmia
    const isArrhythmia = rrVariation > 15;
    
    // Create status string
    const arrhythmiaStatus = isArrhythmia 
      ? `ARRITMIA|${Math.round(rrVariation)}%` 
      : `NORMAL|${Math.round(rrVariation)}%`;
    
    // Create arrhythmia data for record
    const lastArrhythmiaData = isArrhythmia ? {
      timestamp: rrData.lastPeakTime || Date.now(),
      rmssd,
      rrVariation
    } : null;
    
    return { arrhythmiaStatus, lastArrhythmiaData };
  }
}
