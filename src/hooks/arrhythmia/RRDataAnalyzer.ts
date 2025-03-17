
/**
 * Specialized class for RR interval data analysis and logging
 */
export class RRDataAnalyzer {
  /**
   * Logs comprehensive RR interval analysis results for diagnostics
   */
  public logRRAnalysis(analysisData: any, intervals: number[]): void {
    console.log("RRDataAnalyzer: RR intervals analyzed", {
      rmssd: analysisData.rmssd,
      variation: analysisData.rrVariation,
      avgInterval: intervals.reduce((sum, val) => sum + val, 0) / intervals.length,
      timestamp: new Date().toISOString()
    });
  }
}
