import { VitalSignsResult } from '../types/vital-signs-result';

/**
 * Factory for creating VitalSignsResult objects
 */
export class ResultFactory {
  public static createResult(
    spo2: number,
    heartRate: number,
    pressure: string,
    arrhythmiaStatus: string,
    glucose: number,
    glucoseConfidence?: number,
    overallConfidence?: number,
    lastArrhythmiaData?: { timestamp: number; rmssd: number; rrVariation: number } | null
  ): VitalSignsResult {
    return {
      spo2,
      heartRate,
      pressure,
      arrhythmiaStatus,
      glucose,
      glucoseConfidence,
      overallConfidence,
      lastArrhythmiaData
    };
  }

  public static createEmptyResults(): VitalSignsResult {
    return {
      spo2: 0,
      heartRate: 0,
      pressure: '--/--',
      arrhythmiaStatus: '--',
      glucose: 0,
      glucoseConfidence: 0,
      overallConfidence: 0,
      lastArrhythmiaData: null
    };
  }
}
