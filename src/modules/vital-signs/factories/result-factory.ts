
import { VitalSignsResult } from '../types/vital-signs-result';

/**
 * Factory for creating standardized vital signs results
 */
export class ResultFactory {
  /**
   * Creates a complete result with all vital signs
   */
  public static createResult(
    spo2: number,
    heartRate: number,
    pressure: string,
    arrhythmiaStatus: string,
    glucose: number,
    lipids: { totalCholesterol: number; triglycerides: number },
    hemoglobin: number,
    hydration: number,
    glucoseConfidence?: number,
    lipidsConfidence?: number,
    overallConfidence?: number,
    lastArrhythmiaData?: { timestamp: number; rmssd: number; rrVariation: number } | null
  ): VitalSignsResult {
    return {
      spo2,
      heartRate,
      pressure,
      arrhythmiaStatus,
      glucose,
      lipids,
      hemoglobin,
      hydration,
      glucoseConfidence,
      lipidsConfidence,
      overallConfidence,
      lastArrhythmiaData
    };
  }

  /**
   * Creates an empty result with default values
   */
  public static createEmptyResults(): VitalSignsResult {
    return {
      spo2: 0,
      heartRate: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hemoglobin: 0,
      hydration: 0
    };
  }
}
