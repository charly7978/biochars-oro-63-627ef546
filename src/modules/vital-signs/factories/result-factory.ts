
import { VitalSignsResult } from '../types/vital-signs-result';

/**
 * Factory class for creating consistent VitalSignsResult objects
 */
export class ResultFactory {
  /**
   * Creates a VitalSignsResult with all values set to zero or default
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
      hemoglobin: 0,
      lastArrhythmiaData: null
    };
  }
  
  /**
   * Creates a VitalSignsResult with the provided values
   */
  public static createResult(
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
      // Store confidence values individually rather than as a nested object
      // to prevent rendering issues
      glucoseConfidence,
      lipidsConfidence,
      overallConfidence,
      lastArrhythmiaData
    };
  }
}
