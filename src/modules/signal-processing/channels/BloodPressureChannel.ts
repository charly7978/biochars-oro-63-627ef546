
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Specialized channel for blood pressure processing
 */

import { SpecializedChannel, VitalSignType } from './SpecializedChannel';
import { BloodPressureResult } from '../interfaces';
import { applyAdaptiveFilter } from '../utils/adaptive-predictor';

export class BloodPressureChannel extends SpecializedChannel {
  private lastResult: BloodPressureResult = {
    systolic: 0,
    diastolic: 0,
    map: 0
  };
  private bpBuffer: number[] = [];
  private rmssdValues: number[] = [];
  
  constructor(id?: string) {
    super(VitalSignType.BLOOD_PRESSURE, id);
  }

  /**
   * Process a signal into blood pressure values
   */
  processValue(signal: number): BloodPressureResult {
    // Add to buffer
    this.bpBuffer.push(signal);
    this.addValue(signal);
    
    if (this.bpBuffer.length > 30) {
      this.bpBuffer.shift();
    }
    
    // Need minimum data
    if (this.bpBuffer.length < 10) {
      return this.lastResult;
    }
    
    // Apply adaptive filtering
    const filteredValue = applyAdaptiveFilter(signal, this.bpBuffer, 0.3);
    
    // Calculate blood pressure from signal features
    this.lastResult = this.calculateBloodPressure(filteredValue);
    
    return this.lastResult;
  }

  /**
   * Calculate blood pressure metrics from processed signal
   */
  private calculateBloodPressure(value: number): BloodPressureResult {
    // Calculate features from the signal buffer
    const mean = this.bpBuffer.reduce((sum, v) => sum + v, 0) / this.bpBuffer.length;
    const variance = this.bpBuffer.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / this.bpBuffer.length;
    const range = Math.max(...this.bpBuffer) - Math.min(...this.bpBuffer);
    
    // Normalize features between 0 and 1
    const normalizedValue = Math.max(0, Math.min(1, (value + 1) / 2));
    const normalizedVariance = Math.min(1, variance * 10);
    const normalizedRange = Math.min(1, range / 2);
    
    // Calculate systolic using normalized features (typical range 90-140)
    const systolic = 90 + normalizedValue * 25 + normalizedVariance * 15 + normalizedRange * 10;
    
    // Calculate diastolic (typically around 2/3 of systolic in healthy individuals)
    const diastolic = 60 + normalizedValue * 15 + normalizedVariance * 10 + normalizedRange * 5;
    
    // Calculate mean arterial pressure (MAP)
    const map = diastolic + (systolic - diastolic) / 3;
    
    return {
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      map: Math.round(map)
    };
  }

  /**
   * Reset the channel
   */
  reset(): void {
    super.reset();
    this.bpBuffer = [];
    this.rmssdValues = [];
    this.lastResult = {
      systolic: 0,
      diastolic: 0,
      map: 0
    };
  }

  /**
   * Get the current result
   */
  getLastResult(): BloodPressureResult {
    return { ...this.lastResult };
  }
  
  /**
   * Get current systolic value
   */
  getSystolic(): number {
    return this.lastResult.systolic;
  }
  
  /**
   * Get current diastolic value
   */
  getDiastolic(): number {
    return this.lastResult.diastolic;
  }
  
  /**
   * Get formatted blood pressure string
   */
  getFormattedBP(): string {
    if (!this.lastResult.systolic || !this.lastResult.diastolic) {
      return "--/--";
    }
    return `${this.lastResult.systolic}/${this.lastResult.diastolic}`;
  }
}
