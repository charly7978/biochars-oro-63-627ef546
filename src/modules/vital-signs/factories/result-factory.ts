
import { VitalSignsResult } from '../types/vital-signs-result';

/**
 * Factory for creating standardized VitalSignsResult objects
 */
export class ResultFactory {
  /**
   * Create an empty result with default values
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
   * Create a result with confidence values
   */
  public static createResult(
    spo2: number,
    pressure: string,
    arrhythmiaStatus: string,
    glucose: number,
    lipids: { totalCholesterol: number, triglycerides: number },
    confidence?: { glucose: number, lipids: number, overall: number },
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
  
  /**
   * Create a result from raw measurement data
   */
  public static createFromRawData(
    spo2Value: number,
    systolic: number,
    diastolic: number,
    arrhythmiaStatus: string,
    glucoseValue: number,
    cholesterol: number,
    triglycerides: number,
    confidence?: { glucose: number, lipids: number, overall: number },
    lastArrhythmiaData?: any
  ): VitalSignsResult {
    // Format blood pressure
    const pressure = systolic > 0 && diastolic > 0 ? 
      `${systolic}/${diastolic}` : 
      "--/--";
    
    return {
      spo2: spo2Value,
      pressure,
      arrhythmiaStatus,
      glucose: glucoseValue,
      lipids: {
        totalCholesterol: cholesterol,
        triglycerides
      },
      confidence,
      lastArrhythmiaData
    };
  }
}
