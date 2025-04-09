
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsResult } from '../types/vital-signs-result';

/**
 * Factory for creating VitalSignsResult objects
 * Direct measurement only, no simulation
 */
export class ResultFactory {
  /**
   * Create a VitalSignsResult from measured values
   * Direct measurement only, no simulation
   */
  public createResult(params: Partial<VitalSignsResult>): VitalSignsResult {
    return {
      spo2: params.spo2 || 0,
      pressure: params.pressure || "--/--",
      arrhythmiaStatus: params.arrhythmiaStatus || "--",
      glucose: params.glucose || 0,
      lipids: params.lipids || {
        totalCholesterol: 0,
        triglycerides: 0
      },
      lastArrhythmiaData: params.lastArrhythmiaData || null
    };
  }
}

// For easier importing
export const resultFactory = new ResultFactory();
