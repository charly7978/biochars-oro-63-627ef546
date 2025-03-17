
import { ArrhythmiaConfig, RRData } from './types';
import { VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';

export class ArrhythmiaAnalyzer {
  private config: ArrhythmiaConfig;
  private arrhythmiaCount: number = 0;
  private lastArrhythmiaTime: number = 0;

  constructor(config: ArrhythmiaConfig) {
    this.config = config;
  }

  /**
   * Analyze RR intervals to detect arrhythmias
   */
  public analyzeRRData(rrData: RRData, currentResult: VitalSignsResult): VitalSignsResult {
    if (rrData.intervals.length < 4) {
      return currentResult;
    }

    const now = Date.now();
    
    // Basic validation
    const validIntervals = rrData.intervals.filter(
      interval => interval > 400 && interval < 1500
    );
    
    if (validIntervals.length < 3) {
      return {
        ...currentResult,
        arrhythmiaStatus: "Señal de latido normal"
      };
    }
    
    // Calculate statistics
    const avg = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    let sumSquares = 0;
    
    for (let i = 1; i < validIntervals.length; i++) {
      const diff = validIntervals[i] - validIntervals[i-1];
      sumSquares += diff * diff;
    }
    
    // RMSSD calculation
    const rmssd = Math.sqrt(sumSquares / (validIntervals.length - 1));
    const rrVariation = rmssd / avg;
    
    // Detect arrhythmia
    const hasArrhythmia = rrVariation > this.config.SEQUENTIAL_DETECTION_THRESHOLD;
    
    if (hasArrhythmia && 
        now - this.lastArrhythmiaTime > this.config.MIN_TIME_BETWEEN_ARRHYTHMIAS &&
        this.arrhythmiaCount < this.config.MAX_ARRHYTHMIAS_PER_SESSION) {
      
      this.arrhythmiaCount++;
      this.lastArrhythmiaTime = now;
      
      return {
        ...currentResult,
        arrhythmiaStatus: "ARRHYTHMIA DETECTED",
        lastArrhythmiaData: {
          timestamp: now,
          rmssd,
          rrVariation
        }
      };
    }
    
    return {
      ...currentResult,
      arrhythmiaStatus: hasArrhythmia ? "Variación de ritmo detectada" : "Señal de latido normal"
    };
  }

  /**
   * Get current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }

  /**
   * Reset analyzer state
   */
  public reset(): void {
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTime = 0;
  }
}
