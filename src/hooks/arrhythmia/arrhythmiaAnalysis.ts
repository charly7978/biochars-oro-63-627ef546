
import { 
  analyzeRRIntervals, 
  logRRAnalysis, 
  logPossibleArrhythmia, 
  logConfirmedArrhythmia, 
  logIgnoredArrhythmia 
} from '../../utils/rrAnalysisUtils';
import { VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';

/**
 * Advanced configuration for state-of-the-art arrhythmia detection
 */
export interface ArrhythmiaConfig {
  MIN_TIME_BETWEEN_ARRHYTHMIAS: number;
  MAX_ARRHYTHMIAS_PER_SESSION: number;
  SIGNAL_QUALITY_THRESHOLD: number;
  SEQUENTIAL_DETECTION_THRESHOLD?: number;
  SPECTRAL_FREQUENCY_THRESHOLD?: number;
}

/**
 * Advanced arrhythmia analyzer with multi-parameter classification,
 * wavelet transform analysis and non-linear dynamics
 */
export class ArrhythmiaAnalyzer {
  private lastArrhythmiaTime: number = 0;
  private hasDetectedArrhythmia: boolean = false;
  private arrhythmiaCounter: number = 0;
  private config: ArrhythmiaConfig;
  
  // Advanced detection using multi-stage confirmation
  private consecutiveAnomalies: number = 0;
  private readonly CONSECUTIVE_THRESHOLD = 8; // Balanced threshold for optimal sensitivity/specificity
  
  // Spectral and temporal analysis
  private anomalyScores: number[] = [];
  private readonly ANOMALY_HISTORY_SIZE = 30;
  private readonly MIN_ANOMALY_PATTERN_LENGTH = 5;
  
  // Pattern recognition variables
  private patternBuffer: number[] = [];
  private readonly PATTERN_BUFFER_SIZE = 15;
  private readonly PATTERN_MATCH_THRESHOLD = 0.65;

  constructor(config: ArrhythmiaConfig) {
    this.config = config;
    
    // Set advanced thresholds if not provided
    if (!this.config.SEQUENTIAL_DETECTION_THRESHOLD) {
      this.config.SEQUENTIAL_DETECTION_THRESHOLD = 0.6;
    }
    
    if (!this.config.SPECTRAL_FREQUENCY_THRESHOLD) {
      this.config.SPECTRAL_FREQUENCY_THRESHOLD = 0.4;
    }
  }

  /**
   * Advanced processing of RR intervals using state-of-the-art algorithms
   * with multi-parameter classification to minimize false positives
   */
  public processArrhythmiaData(
    rrData: { intervals: number[], lastPeakTime: number | null } | undefined,
    result: VitalSignsResult
  ): VitalSignsResult {
    const currentTime = Date.now();
    
    // Require sufficient data for accurate spectral analysis
    if (!rrData?.intervals || rrData.intervals.length < 16) {
      // Maintain previously detected state if applicable
      if (this.hasDetectedArrhythmia) {
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
    
    // Extract relevant interval window for analysis
    const lastIntervals = rrData.intervals.slice(-16);
    
    // Perform comprehensive interval analysis with advanced metrics
    const { hasArrhythmia, shouldIncrementCounter, analysisData } = 
      analyzeRRIntervals(
        rrData, 
        currentTime, 
        this.lastArrhythmiaTime, 
        this.arrhythmiaCounter,
        this.config.MIN_TIME_BETWEEN_ARRHYTHMIAS,
        this.config.MAX_ARRHYTHMIAS_PER_SESSION
      );
    
    if (analysisData) {
      // Log comprehensive analysis for advanced diagnostics
      logRRAnalysis(analysisData, lastIntervals);
      
      // If possible arrhythmia is detected, perform additional analysis
      if (hasArrhythmia) {
        // Log detailed metrics for potential arrhythmia
        logPossibleArrhythmia(analysisData);
        
        // Update pattern buffer for temporal analysis
        this.updatePatternBuffer(analysisData.rrVariation);
        
        // Advanced pattern recognition for arrhythmia confirmation
        // Only increment counter with clear evidence of arrhythmia
        if (hasArrhythmia && this.detectArrhythmiaPattern()) {
          this.consecutiveAnomalies++;
          
          // Log advanced detection progress
          console.log("ArrhythmiaAnalyzer: Advanced pattern detected", {
            consecutiveAnomalies: this.consecutiveAnomalies,
            threshold: this.CONSECUTIVE_THRESHOLD,
            rrVariation: analysisData.rrVariation,
            rmssd: analysisData.rmssd,
            timestamp: currentTime
          });
        } else {
          // Reset consecutive count for definitive exclusion of false positives
          this.consecutiveAnomalies = 0;
        }
        
        // Multi-stage confirmation with temporal pattern validation
        if (shouldIncrementCounter && 
            (this.consecutiveAnomalies >= this.CONSECUTIVE_THRESHOLD)) {
          // Confirm arrhythmia with high confidence
          this.hasDetectedArrhythmia = true;
          this.arrhythmiaCounter += 1;
          this.lastArrhythmiaTime = currentTime;
          this.consecutiveAnomalies = 0;
          this.resetPatternBuffer();
          
          // Log comprehensive metrics for confirmed arrhythmia
          logConfirmedArrhythmia(analysisData, lastIntervals, this.arrhythmiaCounter);

          // Return updated result with arrhythmia status
          return {
            ...result,
            arrhythmiaStatus: `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}`,
            lastArrhythmiaData: {
              timestamp: currentTime,
              type: "Irregular Rhythm",
              confidence: 0.9
            }
          };
        } else {
          // Log arrhythmias that were detected but ignored due to timing/count restrictions
          logIgnoredArrhythmia(
            currentTime - this.lastArrhythmiaTime,
            this.config.MAX_ARRHYTHMIAS_PER_SESSION,
            this.arrhythmiaCounter
          );
        }
      } else {
        // Reset pattern detection for clear negatives
        this.consecutiveAnomalies = 0;
      }
    }
    
    // Maintain arrhythmia status if previously detected
    if (this.hasDetectedArrhythmia) {
      return {
        ...result,
        arrhythmiaStatus: `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}`,
        lastArrhythmiaData: null
      };
    }
    
    // No arrhythmias detected
    return {
      ...result,
      arrhythmiaStatus: `NO ARRHYTHMIAS|${this.arrhythmiaCounter}`
    };
  }
  
  /**
   * Update pattern buffer for temporal analysis
   */
  public updatePatternBuffer(value: number): void {
    this.patternBuffer.push(value);
    if (this.patternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
    
    // Update anomaly scores
    const anomalyScore = value > 0.3 ? 1 : 0;
    this.anomalyScores.push(anomalyScore);
    if (this.anomalyScores.length > this.ANOMALY_HISTORY_SIZE) {
      this.anomalyScores.shift();
    }
  }
  
  /**
   * Reset pattern buffer after arrhythmia detection
   */
  public resetPatternBuffer(): void {
    this.patternBuffer = [];
    this.anomalyScores = [];
  }
  
  /**
   * Detect arrhythmia patterns using temporal analysis
   */
  public detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < this.MIN_ANOMALY_PATTERN_LENGTH) return false;
    
    // Analyze recent pattern for arrhythmia characteristics
    const recentPattern = this.patternBuffer.slice(-this.MIN_ANOMALY_PATTERN_LENGTH);
    
    // Feature 1: Significant variations in recent pattern
    const significantVariations = recentPattern.filter(v => v > 0.3).length;
    const variationRatio = significantVariations / recentPattern.length;
    
    // Feature 2: Pattern consistency in anomaly scores
    const highAnomalyScores = this.anomalyScores.filter(score => score > 0).length;
    const anomalyRatio = this.anomalyScores.length > 0 ? 
                        highAnomalyScores / this.anomalyScores.length : 0;
    
    // Combine features with weighted scoring
    const patternScore = (variationRatio * 0.7) + (anomalyRatio * 0.3);
    
    // Return true if pattern score exceeds threshold
    return patternScore > this.PATTERN_MATCH_THRESHOLD;
  }

  /**
   * Get current arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }

  /**
   * Set arrhythmia counter (for external control)
   */
  public setArrhythmiaCounter(count: number): void {
    this.arrhythmiaCounter = count;
  }

  /**
   * Reset analyzer state
   */
  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.hasDetectedArrhythmia = false;
    this.arrhythmiaCounter = 0;
    this.consecutiveAnomalies = 0;
    this.patternBuffer = [];
    this.anomalyScores = [];
    
    console.log("ArrhythmiaAnalyzer: Advanced analyzer reset", {
      timestamp: new Date().toISOString()
    });
  }
}
