
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { ArrhythmiaPatternDetector } from './arrhythmia/pattern-detector';

interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
}

interface ArrhythmiaResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd?: number;
    rrVariation?: number;
  } | null;
}

export class ArrhythmiaProcessor {
  private patternDetector: ArrhythmiaPatternDetector;
  private arrhythmiaCount: number = 0;
  private lastArrhythmiaData: { timestamp: number; rmssd?: number; rrVariation?: number; } | null = null;
  
  private readonly RMSSD_THRESHOLD = 25;
  private readonly VARIATION_THRESHOLD = 0.2;
  
  constructor() {
    this.patternDetector = new ArrhythmiaPatternDetector();
  }
  
  /**
   * Process RR interval data to detect arrhythmias
   * Uses only real data, no simulation
   */
  public processRRData(rrData: RRData): ArrhythmiaResult {
    if (rrData.intervals.length < 3) {
      return {
        arrhythmiaStatus: "--",
        lastArrhythmiaData: null
      };
    }
    
    // Calculate RMSSD (root mean square of successive differences)
    const rmssd = this.calculateRMSSD(rrData.intervals);
    
    // Calculate RR interval variation
    const variation = this.calculateRRVariation(rrData.intervals);
    
    // Feed variation into pattern detector
    this.patternDetector.updatePatternBuffer(variation);
    
    // Check for arrhythmia pattern in real data
    const isArrhythmiaPattern = this.patternDetector.detectArrhythmiaPattern();
    
    // Arrhythmia detected if RMSSD or variation exceeds thresholds
    const isArrhythmia = (
      rmssd > this.RMSSD_THRESHOLD || 
      variation > this.VARIATION_THRESHOLD || 
      isArrhythmiaPattern
    );
    
    const timestamp = Date.now();
    
    if (isArrhythmia) {
      this.arrhythmiaCount++;
      this.lastArrhythmiaData = {
        timestamp,
        rmssd,
        rrVariation: variation
      };
      
      return {
        arrhythmiaStatus: "ARRHYTHMIA DETECTED",
        lastArrhythmiaData: this.lastArrhythmiaData
      };
    }
    
    return {
      arrhythmiaStatus: "NORMAL",
      lastArrhythmiaData: this.lastArrhythmiaData
    };
  }
  
  /**
   * Calculate RMSSD from RR intervals
   * Uses only real data
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sumSquaredDiffs = 0;
    
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i - 1];
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiffs / (intervals.length - 1));
  }
  
  /**
   * Calculate RR variation (standard deviation / mean)
   * Uses only real data
   */
  private calculateRRVariation(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    if (mean === 0) return 0;
    
    const sumSquaredDiffs = intervals.reduce((sum, val) => {
      return sum + Math.pow(val - mean, 2);
    }, 0);
    
    const stdDev = Math.sqrt(sumSquaredDiffs / intervals.length);
    
    return stdDev / mean;
  }
  
  /**
   * Get the count of detected arrhythmias
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Reset processor state
   */
  public reset(): void {
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaData = null;
    this.patternDetector.resetPatternBuffer();
  }
}
