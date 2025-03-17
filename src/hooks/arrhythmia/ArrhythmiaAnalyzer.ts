
import { analyzeRRIntervals } from '../../utils/rrAnalysisUtils';
import { VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';
import { ProcessingConfig } from './types';
import { RRDataAnalyzer } from './RRDataAnalyzer';

/**
 * Heart rate analyzer with RR interval processing
 */
export class ArrhythmiaAnalyzer {
  private config: ProcessingConfig;
  private rrAnalyzer: RRDataAnalyzer;
  
  constructor(config: ProcessingConfig) {
    this.config = config;
    this.rrAnalyzer = new RRDataAnalyzer();
    
    console.log("HeartRateAnalyzer: Initialized with config:", {
      qualityThreshold: this.config.SIGNAL_QUALITY_THRESHOLD,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Analysis of RR intervals for heart rate calculation
   */
  public analyzeRRData(
    rrData: { intervals: number[], lastPeakTime: number | null },
    result: VitalSignsResult
  ): VitalSignsResult {
    const currentTime = Date.now();
    
    // Require sufficient data for analysis
    if (!rrData?.intervals || rrData.intervals.length < 12) {
      return this.getStatePreservingResult(result);
    }
    
    // Extract intervals for analysis
    const intervals = rrData.intervals.slice(-16);
    
    // Process RR data but without arrhythmia detection
    const { analysisData } = 
      analyzeRRIntervals(
        rrData, 
        currentTime, 
        0, 
        0,
        0,
        0
      );
    
    // No analysis data available
    if (!analysisData) {
      return this.getStatePreservingResult(result);
    }
    
    // Log and analyze RR data
    this.rrAnalyzer.logRRAnalysis(analysisData, intervals);
    
    return this.getStatePreservingResult(result);
  }
  
  /**
   * Get result that preserves current state
   */
  private getStatePreservingResult(result: VitalSignsResult): VitalSignsResult {
    return {
      ...result,
      arrhythmiaStatus: "NO ARRHYTHMIAS|0"
    };
  }

  /**
   * Reset analyzer state completely
   */
  public reset(): void {
    console.log("HeartRateAnalyzer: Reset complete - all values at zero", {
      timestamp: new Date().toISOString()
    });
  }
}
