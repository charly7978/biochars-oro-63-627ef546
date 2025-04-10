
import { VitalSignsResult } from '../types/vital-signs-result';

/**
 * Factory for creating VitalSignsResult objects
 */
export class ResultFactory {
  /**
   * Create a complete result object with all vital signs
   */
  static createResult(
    spo2: number,
    pressure: string,
    arrhythmiaStatus: string,
    glucose: number,
    lipids: { totalCholesterol: number; triglycerides: number },
    hemoglobin: number,
    glucoseConfidence?: number,
    lipidsConfidence?: number,
    overallConfidence?: number,
    lastArrhythmiaData?: { timestamp: number; rmssd: number; rrVariation: number } | null
  ): VitalSignsResult {
    return {
      spo2,
      pressure,
      arrhythmiaStatus,
      glucose,
      lipids,
      hemoglobin,
      lastArrhythmiaData,
      glucoseConfidence,
      lipidsConfidence,
      overallConfidence
    };
  }
  
  /**
   * Create an empty result object with zero values
   */
  static createEmptyResults(): VitalSignsResult {
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
