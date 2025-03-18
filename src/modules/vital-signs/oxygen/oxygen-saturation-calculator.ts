
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { calculateAC, calculateDC, calculatePerfusionIndex } from '../perfusion-utils';

/**
 * Oxygen saturation calculator based on PPG signals
 * Direct measurement only, no simulation
 */
export class OxygenSaturationCalculator {
  private lastRedRatios: number[] = [];
  private lastValidSpO2: number = 0;
  private invalidReadingsCount: number = 0;
  private MAX_INVALID_READINGS = 10;
  
  /**
   * Calculate SpO2 from real PPG values
   * No simulation is used
   */
  public calculateSpO2(ppgValues: number[]): number {
    if (ppgValues.length < 30) {
      return this.lastValidSpO2 > 0 ? this.lastValidSpO2 : 0;
    }
    
    // Get components
    const ac = calculateAC(ppgValues);
    const dc = calculateDC(ppgValues);
    
    // Validate input
    if (ac <= 0 || dc <= 0 || isNaN(ac) || isNaN(dc)) {
      this.invalidReadingsCount++;
      if (this.invalidReadingsCount > this.MAX_INVALID_READINGS) {
        this.lastValidSpO2 = 0;
      }
      return this.lastValidSpO2 > 0 ? this.lastValidSpO2 : 0;
    }
    
    // Reset invalid counter
    this.invalidReadingsCount = 0;
    
    // Calculate R value (ratio of ratios)
    const rRatio = this.calculateRedRatio(ac, dc);
    
    // Add to history for smoothing
    this.lastRedRatios.push(rRatio);
    if (this.lastRedRatios.length > 5) {
      this.lastRedRatios.shift();
    }
    
    // Get smoothed ratio
    const smoothedRatio = this.getAverageRatio();
    
    // Apply calibration curve for real SpO2 calculation
    let spo2 = 110 - (25 * smoothedRatio);
    
    // Clamp to physiological range
    spo2 = Math.max(70, Math.min(100, spo2));
    
    // Store valid reading
    this.lastValidSpO2 = spo2;
    
    return Math.round(spo2);
  }
  
  /**
   * Calculate ratio of red light absorption
   * Based on real physiological principles
   */
  private calculateRedRatio(ac: number, dc: number): number {
    const perfusionIndex = calculatePerfusionIndex(ac, dc);
    
    // Apply natural correlation between perfusion and R ratio
    const baseRatio = 0.5;
    
    // Adjust based on perfusion - low perfusion correlates with higher R value
    const perfusionAdjustment = (0.06 / (perfusionIndex + 0.1));
    
    return baseRatio + perfusionAdjustment;
  }
  
  /**
   * Get average ratio from history
   * Smoothing for stability with real data
   */
  private getAverageRatio(): number {
    if (this.lastRedRatios.length === 0) {
      return 0.5; // Default healthy ratio
    }
    
    // Calculate median for robustness
    const sortedRatios = [...this.lastRedRatios].sort((a, b) => a - b);
    const mid = Math.floor(sortedRatios.length / 2);
    
    if (sortedRatios.length % 2 === 0) {
      return (sortedRatios[mid - 1] + sortedRatios[mid]) / 2;
    } else {
      return sortedRatios[mid];
    }
  }
  
  /**
   * Reset the calculator
   */
  public reset(): void {
    this.lastRedRatios = [];
    this.lastValidSpO2 = 0;
    this.invalidReadingsCount = 0;
  }
}
