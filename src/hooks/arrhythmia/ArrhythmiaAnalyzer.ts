
import { analyzeRRIntervals } from '../../utils/rrAnalysisUtils';
import { VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';
import { ArrhythmiaConfig } from './types';
import { ArrhythmiaPatternDetector } from './ArrhythmiaPatternDetector';
import { RRDataAnalyzer } from './RRDataAnalyzer';

/**
 * Direct arrhythmia analyzer with natural detection
 * No simulation or reference values used
 */
export class ArrhythmiaAnalyzer {
  private lastArrhythmiaTime: number = 0;
  private arrhythmiaDetected: boolean = false;
  private arrhythmiaCounter: number = 0;
  private config: ArrhythmiaConfig;
  
  // Pattern detection
  private patternDetector: ArrhythmiaPatternDetector;
  private rrAnalyzer: RRDataAnalyzer;
  
  // Consecutive anomalies tracking
  private consecutiveAnomalies: number = 0;
  private readonly CONSECUTIVE_THRESHOLD = 6; // Reduced from 8 for faster detection

  constructor(config: ArrhythmiaConfig) {
    this.config = config;
    this.patternDetector = new ArrhythmiaPatternDetector();
    this.rrAnalyzer = new RRDataAnalyzer();
    
    console.log("ArrhythmiaAnalyzer: Initialized with config:", {
      minTimeBetween: this.config.MIN_TIME_BETWEEN_ARRHYTHMIAS,
      maxPerSession: this.config.MAX_ARRHYTHMIAS_PER_SESSION,
      qualityThreshold: this.config.SIGNAL_QUALITY_THRESHOLD,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Direct analysis of RR intervals for arrhythmia detection
   * No reference values or simulation used
   */
  public analyzeRRData(
    rrData: { intervals: number[], lastPeakTime: number | null },
    result: VitalSignsResult
  ): VitalSignsResult {
    const currentTime = Date.now();
    
    // Require sufficient data for analysis, but with lower threshold
    if (!rrData?.intervals || rrData.intervals.length < 12) { // Reduced from 16
      return this.getStatePreservingResult(result);
    }
    
    // Extract intervals for analysis
    const intervals = rrData.intervals.slice(-16);
    
    // Perform direct analysis without reference values
    const { hasArrhythmia, shouldIncrementCounter, analysisData } = 
      analyzeRRIntervals(
        rrData, 
        currentTime, 
        this.lastArrhythmiaTime, 
        this.arrhythmiaCounter,
        this.config.MIN_TIME_BETWEEN_ARRHYTHMIAS,
        this.config.MAX_ARRHYTHMIAS_PER_SESSION
      );
    
    // No analysis data available
    if (!analysisData) {
      return this.getStatePreservingResult(result);
    }
    
    // Log and analyze RR data
    this.rrAnalyzer.logRRAnalysis(analysisData, intervals);
    
    // If arrhythmia detected, process it
    if (hasArrhythmia) {
      this.rrAnalyzer.logPossibleArrhythmia(analysisData);
      
      // Update pattern detector
      this.patternDetector.updatePatternBuffer(analysisData.rrVariation);
      
      // Check for arrhythmia pattern
      if (this.patternDetector.detectArrhythmiaPattern()) {
        this.consecutiveAnomalies++;
        
        console.log("ArrhythmiaAnalyzer: Pattern detected", {
          consecutiveAnomalies: this.consecutiveAnomalies,
          threshold: this.CONSECUTIVE_THRESHOLD,
          variation: analysisData.rrVariation,
          timestamp: currentTime
        });
      } else {
        this.consecutiveAnomalies = 0;
      }
      
      // Confirm arrhythmia with fewer consecutive anomalies required
      if (shouldIncrementCounter && this.consecutiveAnomalies >= this.CONSECUTIVE_THRESHOLD) {
        return this.confirmArrhythmia(result, currentTime, analysisData, intervals);
      } else {
        this.rrAnalyzer.logIgnoredArrhythmia(
          currentTime - this.lastArrhythmiaTime,
          this.config.MAX_ARRHYTHMIAS_PER_SESSION,
          this.arrhythmiaCounter
        );
      }
    } else {
      // Reset consecutive anomalies for clear negatives
      this.consecutiveAnomalies = 0;
    }
    
    return this.getStatePreservingResult(result);
  }
  
  /**
   * Register confirmed arrhythmia
   */
  private confirmArrhythmia(
    result: VitalSignsResult, 
    currentTime: number,
    analysisData: any,
    intervals: number[]
  ): VitalSignsResult {
    this.arrhythmiaDetected = true;
    this.arrhythmiaCounter++;
    this.lastArrhythmiaTime = currentTime;
    this.consecutiveAnomalies = 0;
    this.patternDetector.resetPatternBuffer();
    
    this.rrAnalyzer.logConfirmedArrhythmia(analysisData, intervals, this.arrhythmiaCounter);
    
    return {
      ...result,
      arrhythmiaStatus: `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}`,
      lastArrhythmiaData: {
        timestamp: currentTime,
        rmssd: analysisData.rmssd,
        rrVariation: analysisData.rrVariation
      }
    };
  }
  
  /**
   * Get result that preserves current arrhythmia state
   */
  private getStatePreservingResult(result: VitalSignsResult): VitalSignsResult {
    if (this.arrhythmiaDetected) {
      return {
        ...result,
        arrhythmiaStatus: `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}`,
        lastArrhythmiaData: null
      };
    }
    
    return {
      ...result,
      arrhythmiaStatus: `NO ARRHYTHMIAS|${this.arrhythmiaCounter}`
    };
  }

  /**
   * Get current arrhythmia counter
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }

  /**
   * Reset analyzer state completely
   */
  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCounter = 0;
    this.consecutiveAnomalies = 0;
    this.patternDetector.resetPatternBuffer();
    
    console.log("ArrhythmiaAnalyzer: Reset complete - all values at zero", {
      timestamp: new Date().toISOString()
    });
  }
}
