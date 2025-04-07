
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsResult } from '../types/vital-signs-result';

/**
 * Factory for creating vital signs measurement results
 * Direct measurement only, no simulation
 */
export class ResultFactory {
  /**
   * Creates a vital signs result object
   * @param data Raw vital signs data
   * @returns VitalSignsResult object
   */
  createResult(data: any): VitalSignsResult {
    return {
      spo2: data.spo2 || 0,
      pressure: data.pressure || "--/--",
      arrhythmiaStatus: data.arrhythmiaStatus || "--",
      glucose: data.glucose || 0,
      lipids: {
        totalCholesterol: data.lipids?.totalCholesterol || 0,
        triglycerides: data.lipids?.triglycerides || 0
      },
      lastArrhythmiaData: data.lastArrhythmiaData || null
    };
  }

  /**
   * Creates an empty vital signs result object
   * @returns Empty VitalSignsResult object
   */
  createEmptyResult(): VitalSignsResult {
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      lastArrhythmiaData: null
    };
  }
}

export const resultFactory = new ResultFactory();
