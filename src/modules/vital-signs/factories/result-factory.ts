
import { VitalSignsResult } from '../types/vital-signs-result';

export class ResultFactory {
  /**
   * Creates an empty result object with zeros for all values
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
   * Creates an empty result but maintains arrhythmia data
   */
  public static createEmptyResultsWithArrhythmia(
    arrhythmiaStatus: string,
    lastArrhythmiaData: any
  ): VitalSignsResult {
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus,
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      lastArrhythmiaData
    };
  }
  
  /**
   * Creates a result object with all the given values
   */
  public static createResult(
    spo2: number,
    pressure: string,
    arrhythmiaStatus: string,
    glucose: number,
    lipids: { totalCholesterol: number; triglycerides: number },
    confidence?: {
      glucose: number;
      lipids: number;
      overall: number;
    },
    lastArrhythmiaData?: any
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
