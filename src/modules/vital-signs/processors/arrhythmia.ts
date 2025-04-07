
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { ArrhythmiaDetectionResult } from '../types/vital-signs-result';

/**
 * Arrhythmia processor - analyzes RR intervals to detect arrhythmias
 * Direct measurement only, no simulation
 */
export class Arrhythmia {
  private arrhythmiaCounter: number = 0;
  private readonly RMSSD_THRESHOLD = 35;
  private readonly RR_VARIATION_THRESHOLD = 0.15;
  private lastArrhythmiaData: ArrhythmiaDetectionResult | null = null;

  /**
   * Detect arrhythmia from RR intervals
   * Direct measurement only, no simulation
   */
  public detectArrhythmia(
    rrData?: { intervals: number[], lastPeakTime: number | null }, 
    quality?: number, 
    isWeakSignal?: boolean
  ): string {
    if (!rrData || !rrData.intervals || rrData.intervals.length < 4 || isWeakSignal || (quality !== undefined && quality < 0.6)) {
      return "--";
    }

    // Calculate RMSSD (Root Mean Square of Successive Differences)
    let rmssd = 0;
    const differences = [];
    
    for (let i = 1; i < rrData.intervals.length; i++) {
      const diff = Math.abs(rrData.intervals[i] - rrData.intervals[i-1]);
      differences.push(diff);
    }
    
    if (differences.length > 0) {
      const sumOfSquares = differences.reduce((sum, diff) => sum + (diff * diff), 0);
      rmssd = Math.sqrt(sumOfSquares / differences.length);
    }
    
    // Calculate RR variation
    const rrVariation = this.calculateRRVariation(rrData.intervals);
    
    // Detect arrhythmia based on threshold
    const isArrhythmia = rmssd > this.RMSSD_THRESHOLD || rrVariation > this.RR_VARIATION_THRESHOLD;
    
    if (isArrhythmia) {
      this.arrhythmiaCounter++;
      
      // Store last arrhythmia data
      this.lastArrhythmiaData = {
        timestamp: Date.now(),
        rmssd,
        rrVariation
      };
      
      return `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}`;
    }
    
    return `NORMAL|${this.arrhythmiaCounter}`;
  }
  
  /**
   * Calculate variation in RR intervals
   */
  private calculateRRVariation(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const varianceSum = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0);
    const stdDev = Math.sqrt(varianceSum / intervals.length);
    
    return stdDev / avg; // Coefficient of variation
  }
  
  /**
   * Get last arrhythmia data
   */
  public getLastArrhythmiaData(): ArrhythmiaDetectionResult | null {
    return this.lastArrhythmiaData;
  }
  
  /**
   * Reset arrhythmia detection
   */
  public reset(): void {
    this.lastArrhythmiaData = null;
  }
  
  /**
   * Reset arrhythmia counter
   */
  public resetCounter(): void {
    this.arrhythmiaCounter = 0;
  }
  
  /**
   * Get arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }
}
