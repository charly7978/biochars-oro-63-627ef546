
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsResult } from '../types/vital-signs-result';

/**
 * Creates standardized result objects for vital signs
 * Only uses direct measurement values, no simulation
 */
export class ResultFactory {
  /**
   * Create an empty result with default values
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
   * Create a result with all metrics from real measurements
   */
  public static createResult(
    spo2: number,
    pressure: string,
    arrhythmiaStatus: string,
    glucose: number,
    lipids: {
      totalCholesterol: number;
      triglycerides: number;
    },
    confidence?: {
      glucose: number;
      lipids: number;
      overall: number;
    },
    lastArrhythmiaData?: { timestamp: number; rmssd?: number; rrVariation?: number; } | null
  ): VitalSignsResult {
    return {
      spo2,
      pressure,
      arrhythmiaStatus,
      glucose,
      lipids,
      confidence,
      lastArrhythmiaData
    };
  }
}
