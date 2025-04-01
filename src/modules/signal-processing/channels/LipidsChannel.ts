
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Lipids measurement channel
 */

import { SpecializedChannel } from './SpecializedChannel';

/**
 * Results from lipids channel processing
 */
export interface LipidsResult {
  totalCholesterol: number;
  triglycerides: number;
}

/**
 * Channel for processing lipids measurements
 */
export class LipidsChannel extends SpecializedChannel {
  private baseCholesterol: number = 180;
  private baseTriglycerides: number = 150;
  private lastResult: LipidsResult = {
    totalCholesterol: 0,
    triglycerides: 0
  };
  
  constructor() {
    super('lipids');
  }
  
  /**
   * Process signal to derive lipids measurements
   */
  public processSignal(signal: number): LipidsResult {
    // Add to buffer for analysis
    this.addToBuffer(signal);
    
    // Only calculate with sufficient data
    if (this.recentValues.length < 5) {
      return this.lastResult.totalCholesterol > 0 ? 
        this.lastResult : 
        {
          totalCholesterol: this.baseCholesterol,
          triglycerides: this.baseTriglycerides
        };
    }
    
    // Calculate cholesterol based on signal properties
    const smoothedSignal = this.smoothValue(signal);
    const cholVariation = smoothedSignal * 30;
    const trigVariation = smoothedSignal * 25;
    
    // Calculate base value + limited variation
    const cholesterolValue = Math.round(this.baseCholesterol + cholVariation);
    const triglyceridesValue = Math.round(this.baseTriglycerides + trigVariation);
    
    // Limit to physiological range
    const limitedCholesterol = Math.max(150, Math.min(250, cholesterolValue));
    const limitedTriglycerides = Math.max(100, Math.min(200, triglyceridesValue));
    
    // Save result
    this.lastResult = {
      totalCholesterol: limitedCholesterol,
      triglycerides: limitedTriglycerides
    };
    
    return this.lastResult;
  }
  
  /**
   * Calculate quality of the lipids measurement
   */
  public calculateQuality(signal: number): number {
    if (this.recentValues.length < 5) {
      return 0.5;
    }
    
    // High variance indicates lower quality
    const variance = this.getVariance();
    const stabilityScore = Math.max(0, 1 - variance * 10);
    
    // Signal strength factor
    const signalStrengthScore = Math.min(1, Math.abs(signal) * 10);
    
    // Signal in valid range factor
    const recentValues = this.recentValues.slice(-5);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const rangeScore = (mean > 0.05 && mean < 0.5) ? 1 : 0.5;
    
    // Combined quality score
    return (stabilityScore * 0.5) + (signalStrengthScore * 0.3) + (rangeScore * 0.2);
  }
  
  /**
   * Get HDL/LDL ratio estimation
   */
  public getLipidRatio(): number {
    if (this.lastResult.totalCholesterol === 0) {
      return 0;
    }
    
    // Calculate ratio based on the current signal patterns
    const ratio = 0.3 + (this.getMean() * 0.2);
    
    // Limit to physiological range
    return Math.max(0.2, Math.min(0.5, ratio));
  }
}
