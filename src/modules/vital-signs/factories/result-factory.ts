
import { VitalSignsResult } from '../types/vital-signs-result';

/**
 * Factory para crear resultados consistentes
 */
export class ResultFactory {
  /**
   * Crea un resultado con todos los valores vitales
   */
  public static createResult(
    spo2: number,
    pressure: string,
    arrhythmiaStatus: string,
    glucose: number,
    lipids: { totalCholesterol: number, triglycerides: number },
    confidence?: {
      glucose: number,
      lipids: number,
      overall: number
    },
    lastArrhythmiaData?: {
      timestamp: number,
      rmssd: number,
      rrVariation: number
    } | null,
    hemoglobin: number = 0
  ): VitalSignsResult {
    return {
      spo2,
      pressure,
      arrhythmiaStatus,
      glucose,
      lipids,
      confidence,
      lastArrhythmiaData,
      hemoglobin
    };
  }
  
  /**
   * Crea un resultado con valores vacíos
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
      },
      hemoglobin: 0
    };
  }
}
