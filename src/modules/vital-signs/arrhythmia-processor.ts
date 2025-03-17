
/**
 * Specialized processor for arrhythmia detection using RR intervals
 */
export class ArrhythmiaProcessor {
  private rmssdHistory: number[] = [];
  private lastArrhythmiaTime: number = 0;
  private arrhythmiaCounter: number = 0;
  
  private readonly RR_WINDOW_SIZE = 15;
  private readonly RMSSD_THRESHOLD = 22;
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 1200;
  private readonly MIN_TIME_BETWEEN_ARRHYTHMIAS = 3500;
  
  constructor() {
    this.reset();
  }
  
  /**
   * Process RR interval data to detect arrhythmias
   */
  public processRRData(rrData: { intervals: number[]; lastPeakTime: number | null }): { 
    arrhythmiaStatus: string; 
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    const now = Date.now();
    
    // Return early if not enough data
    if (!rrData || !rrData.intervals || rrData.intervals.length < 4) {
      return { 
        arrhythmiaStatus: "--", 
        lastArrhythmiaData: null 
      };
    }
    
    // Filter invalid intervals
    const validIntervals = rrData.intervals.filter(interval => 
      interval > 400 && interval < 1500
    );
    
    if (validIntervals.length < 3) {
      return { 
        arrhythmiaStatus: "Señal de latido normal", 
        lastArrhythmiaData: null 
      };
    }
    
    // Calculate statistics on RR intervals
    const lastIntervals = validIntervals.slice(-8);
    const meanRR = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    let sumSquares = 0;
    for (let i = 1; i < lastIntervals.length; i++) {
      const diff = lastIntervals[i] - lastIntervals[i-1];
      sumSquares += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquares / (lastIntervals.length - 1));
    const rrVariation = rmssd / meanRR;
    
    // Track RMSSD history
    this.rmssdHistory.push(rmssd);
    if (this.rmssdHistory.length > this.RR_WINDOW_SIZE) {
      this.rmssdHistory.shift();
    }
    
    // Detect arrhythmia based on threshold
    const hasArrhythmia = rrVariation > 0.25;
    
    // Check if we can register a new arrhythmia
    if (hasArrhythmia && 
        now - this.lastArrhythmiaTime > this.MIN_TIME_BETWEEN_ARRHYTHMIAS) {
      
      this.arrhythmiaCounter++;
      this.lastArrhythmiaTime = now;
      
      return { 
        arrhythmiaStatus: "ARRHYTHMIA DETECTED", 
        lastArrhythmiaData: {
          timestamp: now,
          rmssd,
          rrVariation
        }
      };
    }
    
    return { 
      arrhythmiaStatus: hasArrhythmia ? "Variación de ritmo detectada" : "Señal de latido normal", 
      lastArrhythmiaData: null 
    };
  }
  
  /**
   * Reset the processor
   */
  public reset(): void {
    this.rmssdHistory = [];
    this.lastArrhythmiaTime = 0;
  }
}
