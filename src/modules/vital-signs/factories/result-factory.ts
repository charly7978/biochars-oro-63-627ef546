
import { VitalSignsResult } from '../types/vital-signs-result';
import { ArrhythmiaData } from '../../../core/analysis/ArrhythmiaDetector';

/**
 * Factory for creating standardized vital signs results
 * Ensures consistency across different result formats
 */
export class ResultFactory {
  /**
   * Create a result with all vital sign values
   */
  public static createResult(
    spo2: number,
    pressure: string,
    arrhythmiaStatus: string,
    glucose: number,
    lipids: { totalCholesterol: number; triglycerides: number },
    confidence: { glucose: number; lipids: number; overall: number },
    lastArrhythmiaData: ArrhythmiaData | null
  ): VitalSignsResult {
    return {
      spo2,
      pressure,
      arrhythmiaStatus,
      glucose,
      lipids,
      hemoglobin: 0, // Default value
      lastArrhythmiaData
    };
  }
  
  /**
   * Create an empty result for invalid measurements
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
   * Create a result from partial values
   * Useful when updating specific metrics only
   */
  public static createFromPartial(
    partial: Partial<VitalSignsResult>,
    confidence: { glucose: number; lipids: number; overall: number }
  ): VitalSignsResult {
    return {
      spo2: partial.spo2 || 0,
      pressure: partial.pressure || "--/--",
      arrhythmiaStatus: partial.arrhythmiaStatus || "--",
      glucose: partial.glucose || 0,
      lipids: {
        totalCholesterol: partial.lipids?.totalCholesterol || 0,
        triglycerides: partial.lipids?.triglycerides || 0
      },
      hemoglobin: partial.hemoglobin || 0,
      lastArrhythmiaData: partial.lastArrhythmiaData || null
    };
  }
}
