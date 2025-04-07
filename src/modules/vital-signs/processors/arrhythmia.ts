
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { RRIntervalData } from "../../../hooks/heart-beat/types";

/**
 * Arrhythmia processor - analyzes RR intervals to detect arrhythmias
 * Direct measurement only, no simulation
 */
export class Arrhythmia {
  private arrhythmiaCount: number = 0;
  private readonly MIN_QUALITY = 0.4;
  private rrIntervalHistory: number[] = [];
  private readonly BUFFER_SIZE = 10;
  private lastArrhythmiaData: {
    rmssd: number;
    rrVariation: number;
  } | null = null;

  /**
   * Detect arrhythmia from RR intervals
   * Direct measurement only, no simulation
   */
  public detectArrhythmia(rrData?: RRIntervalData, quality?: number, isWeakSignal?: boolean): string {
    if (isWeakSignal || !rrData || !rrData.intervals || rrData.intervals.length < 3 || (quality !== undefined && quality < this.MIN_QUALITY)) {
      return `NO ARRHYTHMIAS|${this.arrhythmiaCount}`;
    }

    // Update our RR interval history
    this.rrIntervalHistory = [...this.rrIntervalHistory, ...rrData.intervals.slice(-3)];
    
    if (this.rrIntervalHistory.length > this.BUFFER_SIZE) {
      this.rrIntervalHistory = this.rrIntervalHistory.slice(-this.BUFFER_SIZE);
    }
    
    // We need at least 5 intervals for reliable detection
    if (this.rrIntervalHistory.length < 5) {
      return `NO ARRHYTHMIAS|${this.arrhythmiaCount}`;
    }
    
    // Calculate R-R interval variability metrics
    const mean = this.rrIntervalHistory.reduce((sum, val) => sum + val, 0) / this.rrIntervalHistory.length;
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    const successiveDiffs = [];
    for (let i = 1; i < this.rrIntervalHistory.length; i++) {
      successiveDiffs.push(Math.abs(this.rrIntervalHistory[i] - this.rrIntervalHistory[i-1]));
    }
    
    const squaredDiffs = successiveDiffs.map(diff => diff * diff);
    const meanSquaredDiffs = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
    const rmssd = Math.sqrt(meanSquaredDiffs);
    
    // Calculate R-R variation
    const max = Math.max(...this.rrIntervalHistory);
    const min = Math.min(...this.rrIntervalHistory);
    const rrVariation = (max - min) / mean;
    
    // Detect arrhythmia based on direct measures
    const isArrhythmia = rmssd > 50 && rrVariation > 0.2;
    
    // Store arrhythmia data if detected
    if (isArrhythmia) {
      this.arrhythmiaCount++;
      this.lastArrhythmiaData = {
        rmssd,
        rrVariation
      };
      return `ARRHYTHMIA DETECTED|${this.arrhythmiaCount}`;
    }
    
    return this.arrhythmiaCount > 0 
      ? `ARRHYTHMIAS FOUND|${this.arrhythmiaCount}` 
      : `NO ARRHYTHMIAS|${this.arrhythmiaCount}`;
  }

  /**
   * Get last arrhythmia data
   */
  public getLastArrhythmiaData(): {
    rmssd: number;
    rrVariation: number;
  } | null {
    return this.lastArrhythmiaData;
  }

  /**
   * Reset processor state
   */
  public reset(): void {
    this.rrIntervalHistory = [];
    this.lastArrhythmiaData = null;
  }
  
  /**
   * Reset counter
   */
  public resetCounter(): void {
    this.arrhythmiaCount = 0;
  }
  
  /**
   * Get arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
}

