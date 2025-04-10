
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
    confidence?: { glucose: number; lipids: number; overall: number },
    lastArrhythmiaData?: { timestamp: number; rmssd: number; rrVariation: number } | null
  ): VitalSignsResult {
    return {
      spo2,
      pressure,
      arrhythmiaStatus,
      glucose,
      lipids,
      hemoglobin: this.calculateDefaultHemoglobin(spo2),
      confidence,
      lastArrhythmiaData
    };
  }
  
  /**
   * Calculate a default hemoglobin value based on SpO2
   * This is a simple approximation for demonstration purposes
   */
  private static calculateDefaultHemoglobin(spo2: number): number {
    if (spo2 <= 0) return 0;
    
    // Very basic approximation
    // Normally hemoglobin would be measured directly
    // This is just to demonstrate the feature
    const base = 14;
    
    if (spo2 > 95) return base + Math.random();
    if (spo2 > 90) return base - 1 + Math.random();
    if (spo2 > 85) return base - 2 + Math.random();
    
    return base - 3 + Math.random();
  }
}
