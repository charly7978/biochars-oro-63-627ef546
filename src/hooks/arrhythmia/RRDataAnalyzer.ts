
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */

import { RRAnalysisResult } from './types';

/**
 * Specialized class for RR interval data analysis and logging
 * Analyzes only genuine data without simulation
 */
export class RRDataAnalyzer {
  /**
   * Logs comprehensive RR interval analysis results for diagnostic purposes
   * Based only on real measured data
   */
  public logRRAnalysis(analysisData: RRAnalysisResult, intervals: number[]): void {
    if (analysisData.isArrhythmia) {
      console.log("RRDataAnalyzer: Abnormal RR intervals detected", {
        rmssd: analysisData.rmssd,
        variation: analysisData.rrVariation,
        avgInterval: intervals.reduce((sum, val) => sum + val, 0) / intervals.length,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Logs details about possible arrhythmia from real signals
   */
  public logPossibleArrhythmia(analysisData: RRAnalysisResult): void {
    console.log("RRDataAnalyzer: Possible arrhythmia detected", {
      rmssd: analysisData.rmssd,
      rrVariation: analysisData.rrVariation,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Logs confirmed arrhythmia with comprehensive metrics from actual data
   */
  public logConfirmedArrhythmia(analysisData: RRAnalysisResult, intervals: number[], count: number): void {
    console.log("RRDataAnalyzer: ARRHYTHMIA CONFIRMED", {
      arrhythmiaCount: count,
      rmssd: analysisData.rmssd,
      rrVariation: analysisData.rrVariation,
      intervalStats: {
        min: Math.min(...intervals),
        max: Math.max(...intervals),
        avg: intervals.reduce((sum, val) => sum + val, 0) / intervals.length
      },
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Logs arrhythmias that were detected but ignored due to timing or count restrictions
   */
  public logIgnoredArrhythmia(
    timeSinceLastArrhythmia: number,
    maxArrhythmiasPerSession: number,
    currentCount: number
  ): void {
    console.log("RRDataAnalyzer: Potential arrhythmia ignored", {
      timeSinceLast: timeSinceLastArrhythmia,
      maxAllowed: maxArrhythmiasPerSession,
      currentCount: currentCount,
      timestamp: new Date().toISOString()
    });
  }
}
