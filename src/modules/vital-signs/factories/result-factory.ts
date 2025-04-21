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
   * Creates an empty result with default values indicating unavailability.
   */
  public static createEmptyResults(): VitalSignsResult {
    return {
      spo2: NaN,
      pressure: "N/A",
      arrhythmiaStatus: "N/A",
      glucose: NaN,
      lipids: {
        totalCholesterol: NaN,
        triglycerides: NaN
      },
      hemoglobin: NaN,
      hydration: NaN,
      glucoseConfidence: 0,
      lipidsConfidence: 0,
      overallConfidence: 0,
      lastArrhythmiaData: null
    };
  }
}
