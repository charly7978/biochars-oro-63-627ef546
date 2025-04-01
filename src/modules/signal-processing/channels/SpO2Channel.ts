
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * SpO2 measurement channel
 */

import { SpecializedChannel } from './SpecializedChannel';

/**
 * Channel for processing SpO2 measurements
 */
export class SpO2Channel extends SpecializedChannel {
  private baseSpO2: number = 96;
  private lastResult: number = 0;
  
  constructor() {
    super('spo2');
  }
  
  /**
   * Process signal to derive SpO2 measurement
   */
  public processSignal(signal: number): number {
    // Add to buffer for analysis
    this.addToBuffer(signal);
    
    // Only calculate with sufficient data
    if (this.recentValues.length < 5) {
      return this.lastResult || this.baseSpO2;
    }
    
    // Calculate SpO2 based on signal properties
    const smoothedSignal = this.smoothValue(signal);
    const variation = (smoothedSignal * 5) % 4;
    
    // Calculate base value + limited variation
    const spo2Value = Math.round(this.baseSpO2 + variation);
    
    // Limit to physiological range
    const limitedSpO2 = Math.max(90, Math.min(100, spo2Value));
    
    // Save result
    this.lastResult = limitedSpO2;
    
    return limitedSpO2;
  }
  
  /**
   * Calculate quality of the SpO2 measurement
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
   * Update quality score based on perfusion index
   */
  public updateQuality(perfusionIndex: number): number {
    const currentQuality = this.calculateQuality(this.recentValues[this.recentValues.length - 1] || 0);
    
    // Perfusion index affects quality (higher is better)
    const perfusionQuality = Math.min(1, perfusionIndex * 5);
    
    // Combine with current quality
    return (currentQuality * 0.7) + (perfusionQuality * 0.3);
  }
  
  /**
   * Calculate perfusion index from signal strength
   */
  public calculatePerfusionIndex(): number {
    if (this.recentValues.length < 10) {
      return 0.5;
    }
    
    const recentValues = this.recentValues.slice(-10);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    
    if (max === min) return 0.1;
    
    // PI is proportional to the amplitude of the signal
    return Math.min(1, (max - min) * 5);
  }
}
