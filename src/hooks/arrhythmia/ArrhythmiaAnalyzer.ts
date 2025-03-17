
import { ArrhythmiaConfig, RRAnalysisResult } from './types';
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
      return {
        isArrhythmia: this.arrhythmiaDetected,
        arrhythmiaCounter: this.arrhythmiaCounter,
        lastArrhythmiaData: null
      };
    }
    
    // Extract intervals for analysis
    const intervals = rrData.intervals.slice(-16);
    
    // Perform direct analysis without reference values
    const analysisData = this.analyzeIntervals(intervals);
    if (!analysisData) {
      return {
        isArrhythmia: this.arrhythmiaDetected,
        arrhythmiaCounter: this.arrhythmiaCounter,
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
      
      // Check time since last arrhythmia and max count
      const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
      const canIncrementCounter = 
        timeSinceLastArrhythmia >= this.config.MIN_TIME_BETWEEN_ARRHYTHMIAS &&
        this.arrhythmiaCounter < this.config.MAX_ARRHYTHMIAS_PER_SESSION;
      
      // Confirm arrhythmia with fewer consecutive anomalies required
      if (canIncrementCounter && this.consecutiveAnomalies >= this.CONSECUTIVE_THRESHOLD) {
        return this.confirmArrhythmia(currentTime, analysisData, intervals);
      } else {
        this.rrAnalyzer.logIgnoredArrhythmia(
          timeSinceLastArrhythmia,
          this.config.MAX_ARRHYTHMIAS_PER_SESSION,
          this.arrhythmiaCounter
        );
      }
    } else {
      // Reset consecutive anomalies for clear negatives
      this.consecutiveAnomalies = 0;
    }
    
    return {
      isArrhythmia: this.arrhythmiaDetected,
      arrhythmiaCounter: this.arrhythmiaCounter,
      lastArrhythmiaData: null
    };
  }
  
  /**
   * Analyze RR intervals to detect arrhythmias
   */
  private analyzeIntervals(intervals: number[]): RRAnalysisResult | null {
    if (intervals.length < 8) return null;
    
    // Filter for physiological values
    const validIntervals = intervals.filter(i => i >= 400 && i <= 1500);
    if (validIntervals.length < intervals.length * 0.75) return null;
    
    // Calculate key metrics
    const avgRR = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    const lastRR = validIntervals[validIntervals.length - 1];
    const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
    
    // Calculate RMSSD
    let sumSquaredDiff = 0;
    for (let i = 1; i < validIntervals.length; i++) {
      sumSquaredDiff += Math.pow(validIntervals[i] - validIntervals[i-1], 2);
    }
    const rmssd = Math.sqrt(sumSquaredDiff / (validIntervals.length - 1));
    
    // Detect if this is an arrhythmia
    const isArrhythmia = 
      (rrVariation > 0.2) && // Significant variation
      (rmssd > 30);          // Elevated RMSSD
      
    return {
      rmssd,
      rrVariation,
      timestamp: Date.now(),
      isArrhythmia,
      heartRate: Math.round(60000 / avgRR),
      signalQuality: 1.0 - (Math.min(0.5, rrVariation))
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
    this.arrhythmiaDetected = true;
    this.arrhythmiaCounter++;
    this.lastArrhythmiaTime = currentTime;
    this.consecutiveAnomalies = 0;
    this.patternDetector.resetPatternBuffer();
    
    this.rrAnalyzer.logConfirmedArrhythmia(analysisData, intervals, this.arrhythmiaCounter);
    
    return {
      isArrhythmia: true,
      arrhythmiaCounter: this.arrhythmiaCounter,
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
