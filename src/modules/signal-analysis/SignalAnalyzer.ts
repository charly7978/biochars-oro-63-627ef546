
import { VitalSignsResult } from '../vital-signs/VitalSignsProcessor';

/**
 * Helper class to convert arrhythmia detection results to standard format
 */
export class SignalAnalyzer {
  /**
   * Convert arrhythmia data to standardized status string format
   */
  public static getArrhythmiaStatusString(
    arrhythmiaResult: {
      isArrhythmia: boolean;
      arrhythmiaCounter: number;
      lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
    } | null
  ): string {
    if (!arrhythmiaResult) {
      return "--";
    }
    
    // Format: "STATUS|COUNT"
    const status = arrhythmiaResult.isArrhythmia ? "ARRITMIA DETECTADA" : "SIN ARRITMIAS";
    const counter = arrhythmiaResult.arrhythmiaCounter;
    
    return `${status}|${counter}`;
  }
  
  /**
   * Creates an empty result with default values
   */
  public static createEmptyResult(): VitalSignsResult {
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0,
        ldl: 0,
        hdl: 0
      }
    };
  }
  
  /**
   * Analyzes and formats arrhythmia data from the processor for display
   */
  public static formatArrhythmiaResult(
    arrhythmiaResult: {
      isArrhythmia: boolean;
      arrhythmiaCounter: number;
      lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
    }
  ): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    return {
      arrhythmiaStatus: this.getArrhythmiaStatusString(arrhythmiaResult),
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData
    };
  }
}
