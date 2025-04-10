
import { VitalSignsResult, LipidsResult, ArrhythmiaProcessingResult } from '../../../types/vital-signs';

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
    hydration: number,
    glucoseConfidence?: number,
    lipidsConfidence?: number,
    overallConfidence?: number,
    lastArrhythmiaData?: { timestamp: number; rmssd: number; rrVariation: number } | null
  ): VitalSignsResult {
    return {
      spo2,
      pressure,  // Ensure this is a string, not an object
      arrhythmia: arrhythmiaStatus === "--" ? null : {
        arrhythmiaStatus,
        confidence: 0.85
      },
      glucose,
      lipids,
      hydration,
      confidence: overallConfidence || 0,
      timestamp: Date.now()
    };
  }

  /**
   * Creates an empty result with default values
   */
  public static createEmptyResults(): VitalSignsResult {
    return {
      spo2: 0,
      pressure: "--/--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hydration: 0,
      arrhythmia: null,
      confidence: 0,
      timestamp: Date.now()
    };
  }

  public static createArrhythmiaResult(status: string, confidence: number): ArrhythmiaProcessingResult {
    return {
      arrhythmiaStatus: status,
      confidence: confidence
    };
  }

  public static createLipidsResult(totalCholesterol: number, triglycerides: number): LipidsResult {
    return {
      totalCholesterol,
      triglycerides
    };
  }
}
