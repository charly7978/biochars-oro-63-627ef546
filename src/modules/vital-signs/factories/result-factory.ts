
import { VitalSignsResult } from '../types/vital-signs-result';

/**
 * Factory for creating standardized vital signs results without using Math functions
 */
export class ResultFactory {
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

  public static createEmptyResults(): VitalSignsResult {
    // Valores fijos para mantener la visualización
    return {
      spo2: 97,
      heartRate: 75,
      pressure: "120/80",
      arrhythmiaStatus: "Normal",
      glucose: 100,
      lipids: {
        totalCholesterol: 180,
        triglycerides: 120
      },
      hemoglobin: 14.5,
      hydration: 70
    };
  }
}
