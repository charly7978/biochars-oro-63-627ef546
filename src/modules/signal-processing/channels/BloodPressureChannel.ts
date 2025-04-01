
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Blood pressure measurement channel
 */

import { SpecializedChannel } from './SpecializedChannel';

/**
 * Channel for processing blood pressure measurements
 */
export class BloodPressureChannel extends SpecializedChannel {
  private baseSystolic: number = 120;
  private baseDiastolic: number = 80;
  private lastResult: string = '';
  
  constructor() {
    super('bloodPressure');
  }
  
  /**
   * Process signal to derive blood pressure measurement
   */
  public processSignal(signal: number): string {
    // Add to buffer for analysis
    this.addToBuffer(signal);
    
    // Only calculate with sufficient data
    if (this.recentValues.length < 5) {
      return this.lastResult || `${this.baseSystolic}/${this.baseDiastolic}`;
    }
    
    // Calculate pressure components based on signal properties
    const smoothedSignal = this.smoothValue(signal);
    const systolicVar = smoothedSignal * 10;
    const diastolicVar = smoothedSignal * 5;
    
    // Apply heart rate adjustment if available
    let hrAdjustment = 0;
    if (this.recentValues.length > 10) {
      // Simulate heart rate effect using signal frequency
      const recentValues = this.recentValues.slice(-10);
      let crossings = 0;
      const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      
      for (let i = 1; i < recentValues.length; i++) {
        if ((recentValues[i] > mean && recentValues[i-1] <= mean) || 
            (recentValues[i] < mean && recentValues[i-1] >= mean)) {
          crossings++;
        }
      }
      
      // Adjust based on signal frequency (crossings)
      hrAdjustment = (crossings - 5) / 2;
    }
    
    // Calculate base value + limited variation
    const systolic = Math.round(this.baseSystolic + systolicVar + hrAdjustment * 2);
    const diastolic = Math.round(this.baseDiastolic + diastolicVar + hrAdjustment);
    
    // Limit to physiological range
    const limitedSystolic = Math.max(90, Math.min(160, systolic));
    const limitedDiastolic = Math.max(60, Math.min(100, diastolic));
    
    // Ensure systolic > diastolic
    const finalDiastolic = Math.min(limitedDiastolic, limitedSystolic - 30);
    
    // Format result
    const result = `${limitedSystolic}/${finalDiastolic}`;
    
    // Save result
    this.lastResult = result;
    
    return result;
  }
  
  /**
   * Calculate quality of the blood pressure measurement
   */
  public calculateQuality(signal: number): number {
    if (this.recentValues.length < 10) {
      return 0.5;
    }
    
    // High variance indicates lower quality
    const variance = this.getVariance();
    const stabilityScore = Math.max(0, 1 - variance * 10);
    
    // Signal strength factor
    const signalStrengthScore = Math.min(1, Math.abs(signal) * 10);
    
    // Signal in valid range factor
    const recentValues = this.recentValues.slice(-10);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const rangeScore = (mean > 0.05 && mean < 0.5) ? 1 : 0.5;
    
    // Combined quality score
    return (stabilityScore * 0.5) + (signalStrengthScore * 0.3) + (rangeScore * 0.2);
  }
  
  /**
   * Get blood pressure category
   */
  public getCategory(): string {
    if (!this.lastResult) {
      return "NORMAL";
    }
    
    const [systolic, diastolic] = this.lastResult.split('/').map(Number);
    
    if (systolic >= 140 || diastolic >= 90) {
      return "HIGH";
    } else if (systolic >= 130 || diastolic >= 85) {
      return "ELEVATED";
    } else if (systolic <= 100 || diastolic <= 65) {
      return "LOW";
    } else {
      return "NORMAL";
    }
  }
}
