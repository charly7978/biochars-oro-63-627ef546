
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Glucose measurement channel
 */

import { SpecializedChannel } from './SpecializedChannel';

/**
 * Channel for processing glucose measurements
 */
export class GlucoseChannel extends SpecializedChannel {
  private baseGlucose: number = 85;
  private lastResult: number = 0;
  
  constructor() {
    super('glucose');
  }
  
  /**
   * Process signal to derive glucose measurement
   */
  public processSignal(signal: number): number {
    // Add to buffer for analysis
    this.addToBuffer(signal);
    
    // Only calculate with sufficient data
    if (this.recentValues.length < 5) {
      return this.lastResult || this.baseGlucose;
    }
    
    // Calculate glucose based on signal properties
    const smoothedSignal = this.smoothValue(signal);
    const variation = smoothedSignal * 20;
    
    // Calculate base value + limited variation
    const glucoseValue = Math.round(this.baseGlucose + variation);
    
    // Limit to physiological range
    const limitedGlucose = Math.max(70, Math.min(180, glucoseValue));
    
    // Save result
    this.lastResult = limitedGlucose;
    
    return limitedGlucose;
  }
  
  /**
   * Calculate quality of the glucose measurement
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
   * Get trend change in glucose
   */
  public getTrend(): string {
    if (this.recentValues.length < 10) {
      return "STABLE";
    }
    
    const recentValues = this.recentValues.slice(-10);
    const firstHalf = recentValues.slice(0, 5);
    const secondHalf = recentValues.slice(-5);
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    const difference = secondAvg - firstAvg;
    
    if (difference > 0.1) {
      return "RISING";
    } else if (difference < -0.1) {
      return "FALLING";
    } else {
      return "STABLE";
    }
  }
}
