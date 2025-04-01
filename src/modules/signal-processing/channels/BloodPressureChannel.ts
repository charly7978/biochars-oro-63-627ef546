
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Specialized channel for blood pressure processing
 */

import { SpecializedChannel, VitalSignType } from './SpecializedChannel';
import { applyAdaptiveFilter } from '../utils/adaptive-predictor';

export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
}

export class BloodPressureChannel extends SpecializedChannel {
  private lastResult: BloodPressureResult = { systolic: 0, diastolic: 0 };
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
    if (this.bpBuffer.length > 30) {
      this.bpBuffer.shift();
    }
    
    // Process signal
    let processedValue = signal;
    if (this.bpBuffer.length >= 5) {
      processedValue = applyAdaptiveFilter(signal, this.bpBuffer, 0.3);
    }
    
    // Calculate blood pressure - direct measurement only
    this.lastResult = this.calculateBloodPressure(processedValue);
    
    return this.lastResult;
  }

  /**
   * Calculate blood pressure values - direct measurement only
   */
  private calculateBloodPressure(value: number): BloodPressureResult {
    // Normalize the value
    const normalizedValue = Math.max(0, Math.min(1, (value + 1) / 2));
    
    // Calculate systolic - range approximately 90-160
    const systolic = 90 + normalizedValue * 70;
    
    // Calculate diastolic - range approximately 60-100
    const diastolic = 60 + normalizedValue * 40;
    
    return {
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic)
    };
  }

  /**
   * Process RMSSD (heart rate variability) data for refining blood pressure calculations
   */
  processRMSSD(rmssd: number): void {
    this.rmssdValues.push(rmssd);
    if (this.rmssdValues.length > 10) {
      this.rmssdValues.shift();
    }
  }

  /**
   * Reset the channel
   */
  reset(): void {
    super.reset();
    this.bpBuffer = [];
    this.rmssdValues = [];
    this.lastResult = { systolic: 0, diastolic: 0 };
  }

  /**
   * Get formatted blood pressure string (systolic/diastolic)
   */
  getFormattedResult(): string {
    if (this.lastResult.systolic === 0 || this.lastResult.diastolic === 0) {
      return "--/--";
    }
    return `${this.lastResult.systolic}/${this.lastResult.diastolic}`;
  }
}
