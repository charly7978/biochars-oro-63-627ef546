
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateRMSSD, calculateRRVariation } from './calculations';

/**
 * Arrhythmia detector based on real R-R intervals
 * No simulation or reference values are used
 */
export class ArrhythmiaDetector {
  private rrHistory: number[][] = [];
  private readonly HISTORY_SIZE = 5;
  private stabilityCounter: number = 0;
  
  /**
   * Detect arrhythmia from real R-R intervals
   */
  public detectArrhythmia(rrIntervals: number[]): { isArrhythmia: boolean, score: number } {
    if (rrIntervals.length < 5) {
      return { isArrhythmia: false, score: 0 };
    }
    
    // Store intervals for analysis
    this.rrHistory.push([...rrIntervals]);
    if (this.rrHistory.length > this.HISTORY_SIZE) {
      this.rrHistory.shift();
    }
    
    // Calculate RMSSD (Root Mean Square of Successive Differences)
    const rmssd = calculateRMSSD(rrIntervals);
    
    // Calculate RR variation
    const variationRatio = calculateRRVariation(rrIntervals);
    
    // More strict threshold for detection to reduce false positives
    let thresholdFactor = 0.30;
    if (this.stabilityCounter > 15) {
      thresholdFactor = 0.25;
    } else if (this.stabilityCounter < 5) {
      thresholdFactor = 0.35;
    }
    
    const isIrregular = variationRatio > thresholdFactor;
    
    if (!isIrregular) {
      this.stabilityCounter = Math.min(30, this.stabilityCounter + 1);
    } else {
      this.stabilityCounter = Math.max(0, this.stabilityCounter - 2);
    }
    
    // Require more stability before reporting arrhythmia to reduce false positives
    const isArrhythmia = isIrregular && this.stabilityCounter > 12;
    
    return {
      isArrhythmia,
      score: variationRatio
    };
  }
  
  /**
   * Reset the detector
   */
  public reset(): void {
    this.rrHistory = [];
    this.stabilityCounter = 0;
  }
}
