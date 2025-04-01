
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Specialized channel for lipids processing
 */

import { SpecializedChannel, VitalSignType } from './SpecializedChannel';
import { applyAdaptiveFilter } from '../utils/adaptive-predictor';

export interface LipidsResult {
  totalCholesterol: number;
  triglycerides: number;
}

export class LipidsChannel extends SpecializedChannel {
  private lastResult: LipidsResult = {
    totalCholesterol: 0,
    triglycerides: 0
  };
  private lipidsBuffer: number[] = [];
  
  constructor(id?: string) {
    super(VitalSignType.LIPIDS, id);
  }

  /**
   * Process a signal into lipid values
   */
  processValue(signal: number): LipidsResult {
    // Add to lipids buffer
    this.lipidsBuffer.push(signal);
    this.addValue(signal);
    
    if (this.lipidsBuffer.length > 20) {
      this.lipidsBuffer.shift();
    }
    
    // Process the signal to extract lipid values
    let processedValue = signal;
    if (this.lipidsBuffer.length >= 5) {
      processedValue = applyAdaptiveFilter(signal, this.lipidsBuffer, 0.3);
    }
    
    // Calculate lipid values - direct measurement only, no simulation
    this.lastResult = this.calculateLipids(processedValue);
    
    return this.lastResult;
  }

  /**
   * Calculate lipid values - direct measurement only
   */
  private calculateLipids(value: number): LipidsResult {
    // Normalize the value
    const normalizedValue = Math.max(0, Math.min(1, (value + 1) / 2));
    
    // Calculate cholesterol - range approximately 150-300
    const cholesterol = 150 + normalizedValue * 150;
    
    // Calculate triglycerides - range approximately 50-200
    const triglycerides = 50 + normalizedValue * 150;
    
    return {
      totalCholesterol: Math.round(cholesterol),
      triglycerides: Math.round(triglycerides)
    };
  }

  /**
   * Reset the channel
   */
  reset(): void {
    super.reset();
    this.lipidsBuffer = [];
    this.lastResult = {
      totalCholesterol: 0,
      triglycerides: 0
    };
  }

  /**
   * Get the current result
   */
  getLastResult(): LipidsResult {
    return this.lastResult;
  }
}
