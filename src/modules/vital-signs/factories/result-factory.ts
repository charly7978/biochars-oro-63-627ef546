
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import type { VitalSignsResult } from '../../../types/vital-signs';

/**
 * Factory for creating consistent VitalSignsResult objects
 * All methods work with real data only, no simulation
 */
export class ResultFactory {
  /**
   * Creates an empty result when there is no valid data
   * Always returns zeros, no simulation
   */
  public static createEmptyResults(): VitalSignsResult {
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      }
    };
  }
  
  /**
   * Creates a result with the given values
   * Only for direct measurements
   */
  public static createResult(
    spo2: number,
    pressure: string,
    arrhythmiaStatus: string,
    glucose: number,
    lipids: { totalCholesterol: number; triglycerides: number },
    confidence?: { glucose: number; lipids: number; overall: number },
    lastArrhythmiaData?: { timestamp: number; rmssd: number; rrVariation: number } | null
  ): VitalSignsResult {
    const result: VitalSignsResult = {
      spo2,
      pressure,
      arrhythmiaStatus,
      glucose,
      lipids,
      lastArrhythmiaData
    };
    
    // Add confidence if provided
    if (confidence) {
      result.confidence = confidence;
    }
    
    return result;
  }
}
