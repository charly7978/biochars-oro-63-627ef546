
/**
 * Specialized class for RR interval data analysis and logging
 */
export class RRDataAnalyzer {
  /**
   * Logs comprehensive RR interval analysis results for diagnostics
   */
  public logRRAnalysis(analysisData: any, intervals: number[]): void {
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
   * Logs details about possible arrhythmia
   */
  public logPossibleArrhythmia(analysisData: any): void {
    console.log("RRDataAnalyzer: Possible arrhythmia detected", {
      rmssd: analysisData.rmssd,
      rrVariation: analysisData.rrVariation,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Logs confirmed arrhythmia with comprehensive metrics
   */
  public logConfirmedArrhythmia(analysisData: any, intervals: number[], count: number): void {
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
