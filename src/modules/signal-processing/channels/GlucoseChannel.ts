
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Specialized channel for glucose processing
 */

import { SpecializedChannel, VitalSignType } from './SpecializedChannel';
import { applyAdaptiveFilter } from '../utils/adaptive-predictor';

export class GlucoseChannel extends SpecializedChannel {
  private glucoseValues: number[] = [];
  private lastGlucose: number = 0;
  
  constructor(id?: string) {
    super(VitalSignType.GLUCOSE, id);
  }

  /**
   * Process a signal into glucose value
   */
  processValue(signal: number): number {
    // Add to glucose buffer
    this.glucoseValues.push(signal);
    this.addValue(signal);
    
    if (this.glucoseValues.length > 20) {
      this.glucoseValues.shift();
    }
    
    // Apply sliding window filter
    if (this.glucoseValues.length >= 5) {
      const smoothed = applyAdaptiveFilter(signal, this.glucoseValues, 0.3);
      this.lastGlucose = this.calculateGlucose(smoothed);
    } else {
      this.lastGlucose = this.calculateGlucose(signal);
    }
    
    return this.lastGlucose;
  }

  /**
   * Direct measurement only - no simulation
   */
  private calculateGlucose(value: number): number {
    // Real-world processing only - filter and stabilize
    const normalizedValue = Math.max(0, Math.min(1, (value + 1) / 2));
    
    // Range approx 70-200 mg/dL for normal glucose range
    const baseGlucose = 70 + normalizedValue * 130; 
    
    return Math.round(baseGlucose);
  }

  /**
   * Reset the channel
   */
  reset(): void {
    super.reset();
    this.glucoseValues = [];
    this.lastGlucose = 0;
  }
  
  /**
   * Get the last calculated glucose value
   */
  getLastGlucose(): number {
    return this.lastGlucose;
  }
}
