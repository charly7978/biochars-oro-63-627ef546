
/**
 * Simple class for RR interval data analysis and logging
 */
export class RRDataAnalyzer {
  /**
   * Logs RR interval analysis results for diagnostics
   */
  public logRRAnalysis(analysisData: any, intervals: number[]): void {
    console.log("RRDataAnalyzer: RR intervals logged", {
      rmssd: analysisData.rmssd,
      variation: analysisData.rrVariation,
      avgInterval: intervals.reduce((sum, val) => sum + val, 0) / intervals.length,
      timestamp: new Date().toISOString()
    });
  }
}
