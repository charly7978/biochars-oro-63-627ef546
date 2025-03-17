
import { ArrhythmiaConfig, RRAnalysisResult } from './types';
import { ArrhythmiaPatternDetector } from './ArrhythmiaPatternDetector';
import { RRDataAnalyzer } from './RRDataAnalyzer';
import { RRIntervalAnalyzer } from './RRIntervalAnalyzer';
import { ArrhythmiaStateManager } from './ArrhythmiaStateManager';

/**
 * Direct arrhythmia analyzer with natural detection
 * No simulation or reference values used
 */
export class ArrhythmiaAnalyzer {
  private config: ArrhythmiaConfig;
  
  // Component managers
  private patternDetector: ArrhythmiaPatternDetector;
  private rrAnalyzer: RRDataAnalyzer;
  private intervalAnalyzer: RRIntervalAnalyzer;
  private stateManager: ArrhythmiaStateManager;

  constructor(config: ArrhythmiaConfig) {
    this.config = config;
    this.patternDetector = new ArrhythmiaPatternDetector();
    this.rrAnalyzer = new RRDataAnalyzer();
    this.intervalAnalyzer = new RRIntervalAnalyzer();
    this.stateManager = new ArrhythmiaStateManager();
    
    console.log("ArrhythmiaAnalyzer: Initialized with config:", {
      minTimeBetween: this.config.MIN_TIME_BETWEEN_ARRHYTHMIAS,
      maxPerSession: this.config.MAX_ARRHYTHMIAS_PER_SESSION,
      qualityThreshold: this.config.SIGNAL_QUALITY_THRESHOLD,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Direct analysis of RR intervals for arrhythmia detection
   */
  public analyzeRRData(
    rrData: { intervals: number[], lastPeakTime: number | null }
  ): {
    isArrhythmia: boolean;
    arrhythmiaCounter: number;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    const currentTime = Date.now();
    
    // Require sufficient data for analysis, but with lower threshold
    if (!rrData?.intervals || rrData.intervals.length < 12) {
      const state = this.stateManager.getState();
      return {
        isArrhythmia: state.isArrhythmia,
        arrhythmiaCounter: state.arrhythmiaCounter,
        lastArrhythmiaData: null
      };
    }
    
    // Extract intervals for analysis
    const intervals = rrData.intervals.slice(-16);
    
    // Perform direct analysis without reference values
    const analysisData = this.intervalAnalyzer.analyzeIntervals(intervals);
    if (!analysisData) {
      const state = this.stateManager.getState();
      return {
        isArrhythmia: state.isArrhythmia,
        arrhythmiaCounter: state.arrhythmiaCounter,
        lastArrhythmiaData: null
      };
    }
    
    // Log and analyze RR data
    this.rrAnalyzer.logRRAnalysis(analysisData, intervals);
    
    // If arrhythmia detected, process it
    if (analysisData.isArrhythmia) {
      this.rrAnalyzer.logPossibleArrhythmia(analysisData);
      
      // Update pattern detector
      this.patternDetector.updatePatternBuffer(analysisData.rrVariation);
      
      // Check for arrhythmia pattern
      const isPatternDetected = this.patternDetector.detectArrhythmiaPattern();
      this.stateManager.updateConsecutiveAnomalies(isPatternDetected);
      
      if (isPatternDetected) {
        console.log("ArrhythmiaAnalyzer: Pattern detected", {
          consecutiveAnomalies: this.stateManager.getConsecutiveAnomalies(),
          variation: analysisData.rrVariation,
          timestamp: currentTime
        });
      }
      
      // Check time since last arrhythmia and max count
      const canIncrementCounter = this.stateManager.canIncrementCounter(
        currentTime, 
        this.config.MIN_TIME_BETWEEN_ARRHYTHMIAS,
        this.config.MAX_ARRHYTHMIAS_PER_SESSION
      );
      
      // Confirm arrhythmia with fewer consecutive anomalies required
      if (canIncrementCounter && this.stateManager.isThresholdReached()) {
        return this.confirmArrhythmia(currentTime, analysisData, intervals);
      } else {
        this.rrAnalyzer.logIgnoredArrhythmia(
          currentTime - this.stateManager.getState().lastArrhythmiaTime,
          this.config.MAX_ARRHYTHMIAS_PER_SESSION,
          this.stateManager.getState().arrhythmiaCounter
        );
      }
    } else {
      // Reset consecutive anomalies for clear negatives
      this.stateManager.updateConsecutiveAnomalies(false);
    }
    
    const state = this.stateManager.getState();
    return {
      isArrhythmia: state.isArrhythmia,
      arrhythmiaCounter: state.arrhythmiaCounter,
      lastArrhythmiaData: null
    };
  }
  
  /**
   * Register confirmed arrhythmia
   */
  private confirmArrhythmia(
    currentTime: number,
    analysisData: RRAnalysisResult,
    intervals: number[]
  ): {
    isArrhythmia: boolean;
    arrhythmiaCounter: number;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; };
  } {
    this.stateManager.confirmArrhythmia(currentTime);
    this.patternDetector.resetPatternBuffer();
    
    this.rrAnalyzer.logConfirmedArrhythmia(
      analysisData, 
      intervals, 
      this.stateManager.getState().arrhythmiaCounter
    );
    
    return {
      isArrhythmia: true,
      arrhythmiaCounter: this.stateManager.getState().arrhythmiaCounter,
      lastArrhythmiaData: {
        timestamp: currentTime,
        rmssd: analysisData.rmssd,
        rrVariation: analysisData.rrVariation
      }
    };
  }

  /**
   * Get current arrhythmia counter
   */
  public getArrhythmiaCount(): number {
    return this.stateManager.getState().arrhythmiaCounter;
  }

  /**
   * Reset analyzer state completely
   */
  public reset(): void {
    this.stateManager.reset();
    this.patternDetector.resetPatternBuffer();
    
    console.log("ArrhythmiaAnalyzer: Reset complete - all values at zero", {
      timestamp: new Date().toISOString()
    });
  }
}
