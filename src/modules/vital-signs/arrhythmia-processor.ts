
/**
 * Processor for detecting cardiac arrhythmias from RR intervals
 */
export class ArrhythmiaProcessor {
  private readonly RMSSD_THRESHOLD = 30;
  private readonly RR_WINDOW_SIZE = 5;
  private rrIntervals: number[] = [];
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private readonly MIN_TIME_BETWEEN_ARRHYTHMIAS = 1000;
  private lastArrhythmiaTime: number = 0;
  
  /**
   * Process RR intervals to detect arrhythmias
   */
  public processRRData(rrData?: { 
    intervals: number[]; 
    lastPeakTime: number | null 
  }): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { 
      timestamp: number; 
      rmssd: number; 
      rrVariation: number; 
    } | null;
  } {
    // If no data provided, return current status
    if (!rrData || !rrData.intervals || rrData.intervals.length < 3) {
      return {
        arrhythmiaStatus: this.arrhythmiaDetected ? 
          `ARRITMIA DETECTADA|${this.arrhythmiaCount}` : 
          `SIN ARRITMIAS|${this.arrhythmiaCount}`,
        lastArrhythmiaData: null
      };
    }

    // Update internal RR intervals
    this.rrIntervals = [...rrData.intervals].slice(-10);
    
    // Need at least 3 intervals for analysis
    if (this.rrIntervals.length < 3) {
      return {
        arrhythmiaStatus: `SIN ARRITMIAS|${this.arrhythmiaCount}`,
        lastArrhythmiaData: null
      };
    }

    // Get the most recent intervals for analysis
    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    let sumSquaredDiff = 0;
    for (let i = 1; i < recentRR.length; i++) {
      const diff = recentRR[i] - recentRR[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / (recentRR.length - 1));
    
    // Calculate average RR interval
    const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
    
    // Get the last RR interval
    const lastRR = recentRR[recentRR.length - 1];
    
    // Calculate variation ratio
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    console.log("ArrhythmiaProcessor: Análisis RR", {
      rmssd,
      threshold: this.RMSSD_THRESHOLD,
      avgRR,
      lastRR,
      rrVariation
    });

    // Detect arrhythmia based on multiple criteria
    const hasArrhythmia = (rmssd > this.RMSSD_THRESHOLD && rrVariation > 0.2) || 
                          (rrVariation > 0.3);
                            
    const currentTime = Date.now();
    
    // Only count as new arrhythmia if enough time has passed
    if (hasArrhythmia && 
        !this.arrhythmiaDetected && 
        currentTime - this.lastArrhythmiaTime > this.MIN_TIME_BETWEEN_ARRHYTHMIAS) {
      
      this.arrhythmiaCount++;
      this.lastArrhythmiaTime = currentTime;
      this.arrhythmiaDetected = true;
      
      console.log("ArrhythmiaProcessor: Nueva arritmia detectada", {
        contador: this.arrhythmiaCount,
        rmssd,
        rrVariation
      });
      
      return {
        arrhythmiaStatus: `ARRITMIA DETECTADA|${this.arrhythmiaCount}`,
        lastArrhythmiaData: {
          timestamp: currentTime,
          rmssd,
          rrVariation
        }
      };
    }
    
    // Update arrhythmia status without incrementing count
    this.arrhythmiaDetected = hasArrhythmia;
    
    return {
      arrhythmiaStatus: this.arrhythmiaDetected ? 
        `ARRITMIA DETECTADA|${this.arrhythmiaCount}` : 
        `SIN ARRITMIAS|${this.arrhythmiaCount}`,
      lastArrhythmiaData: null
    };
  }
  
  /**
   * Reset processor state
   */
  public reset(): void {
    this.rrIntervals = [];
    this.arrhythmiaDetected = false;
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTime = 0;
  }
}
