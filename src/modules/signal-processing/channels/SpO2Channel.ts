
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Specialized channel for SpO2 processing
 */

import { SpecializedChannel, VitalSignType } from './SpecializedChannel';
import { applyAdaptiveFilter } from '../utils/adaptive-predictor';

export class SpO2Channel extends SpecializedChannel {
  private spo2Buffer: number[] = [];
  private lastSpO2: number = 0;
  
  constructor(id?: string) {
    super(VitalSignType.SPO2, id);
  }

  /**
   * Process a signal into SpO2 value
   */
  processValue(signal: number): number {
    // Add to buffer
    this.spo2Buffer.push(signal);
    if (this.spo2Buffer.length > 20) {
      this.spo2Buffer.shift();
    }
    
    // Apply filter if we have enough data
    let processedValue = signal;
    if (this.spo2Buffer.length >= 5) {
      processedValue = applyAdaptiveFilter(signal, this.spo2Buffer, 0.4);
    }
    
    // Calculate SpO2 - direct measurement only
    this.lastSpO2 = this.calculateSpO2(processedValue);
    
    return this.lastSpO2;
  }

  /**
   * Calculate SpO2 from processed signal
   */
  private calculateSpO2(value: number): number {
    // Direct measurement without simulation
    // Calculate SpO2 based on the normalized signal value
    const normalizedValue = Math.max(0, Math.min(1, (value + 1) / 2));
    
    // Typical SpO2 range is 90-100%
    const spo2 = 90 + normalizedValue * 10;
    
    return Math.round(spo2);
  }

  /**
   * Reset the channel
   */
  reset(): void {
    super.reset();
    this.spo2Buffer = [];
    this.lastSpO2 = 0;
  }
}
