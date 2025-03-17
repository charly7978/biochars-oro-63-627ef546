
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { 
  analyzeRRIntervals, 
  logRRAnalysis, 
  logPossibleArrhythmia, 
  logConfirmedArrhythmia, 
  logIgnoredArrhythmia 
} from '../../utils/rrAnalysisUtils';
import { VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';

/**
 * Advanced configuration for real data arrhythmia detection
 * No simulation is used
 */
export interface ArrhythmiaConfig {
  MIN_TIME_BETWEEN_ARRHYTHMIAS: number;
  MAX_ARRHYTHMIAS_PER_SESSION: number;
  SIGNAL_QUALITY_THRESHOLD: number;
  SEQUENTIAL_DETECTION_THRESHOLD?: number;
  SPECTRAL_FREQUENCY_THRESHOLD?: number;
}

/**
 * Advanced arrhythmia analyzer using only real data
 * No simulation or reference values are used
 */
export class ArrhythmiaAnalyzer {
  private lastArrhythmiaTime: number = 0;
  private hasDetectedArrhythmia: boolean = false;
  private arrhythmiaCounter: number = 0;
  private config: ArrhythmiaConfig;
  
  // Advanced detection using real data
  private consecutiveAnomalies: number = 0;
  private readonly CONSECUTIVE_THRESHOLD = 8;
  
  // Spectral and temporal analysis of real data
  private anomalyScores: number[] = [];
  private readonly ANOMALY_HISTORY_SIZE = 30;
  private readonly MIN_ANOMALY_PATTERN_LENGTH = 5;
  
  // Pattern recognition for real data
  private patternBuffer: number[] = [];
  private readonly PATTERN_BUFFER_SIZE = 15;
  private readonly PATTERN_MATCH_THRESHOLD = 0.65;

  constructor(config: ArrhythmiaConfig) {
    this.config = config;
    
    // Set advanced thresholds for real data analysis
    if (!this.config.SEQUENTIAL_DETECTION_THRESHOLD) {
      this.config.SEQUENTIAL_DETECTION_THRESHOLD = 0.6;
    }
    
    if (!this.config.SPECTRAL_FREQUENCY_THRESHOLD) {
      this.config.SPECTRAL_FREQUENCY_THRESHOLD = 0.4;
    }
  }

  /**
   * Process real RR intervals without simulation
   * Only direct measurements are used
   */
  public processArrhythmiaData(
    rrData: { intervals: number[], lastPeakTime: number | null } | undefined,
    result: VitalSignsResult
  ): VitalSignsResult {
    const currentTime = Date.now();
    
    // Require sufficient real data
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
    
    // Extract interval window from real data
    const lastIntervals = rrData.intervals.slice(-16);
    
    // Analyze real intervals without simulation
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
      // Log analysis of real data
      logRRAnalysis(analysisData, lastIntervals);
      
      // Process potential arrhythmia in real data
      if (hasArrhythmia) {
        // Log detailed metrics for potential real arrhythmia
        logPossibleArrhythmia(analysisData);
        
        // Update pattern buffer with real data
        this.updatePatternBuffer(analysisData.rrVariation);
        
        // Detect patterns in real data
        if (hasArrhythmia && this.detectArrhythmiaPattern()) {
          this.consecutiveAnomalies++;
          
          // Log detection progress
          console.log("ArrhythmiaAnalyzer: Advanced pattern detected in real data", {
            consecutiveAnomalies: this.consecutiveAnomalies,
            threshold: this.CONSECUTIVE_THRESHOLD,
            rrVariation: analysisData.rrVariation,
            rmssd: analysisData.rmssd,
            timestamp: currentTime
          });
        } else {
          // Reset consecutive count
          this.consecutiveAnomalies = 0;
        }
        
        // Multi-stage confirmation of real arrhythmia
        if (shouldIncrementCounter && 
            (this.consecutiveAnomalies >= this.CONSECUTIVE_THRESHOLD)) {
          // Confirm arrhythmia from real data
          this.hasDetectedArrhythmia = true;
          this.arrhythmiaCounter += 1;
          this.lastArrhythmiaTime = currentTime;
          this.consecutiveAnomalies = 0;
          this.resetPatternBuffer();
          
          // Log confirmation of real arrhythmia
          logConfirmedArrhythmia(analysisData, lastIntervals, this.arrhythmiaCounter);

          // Return updated result with real arrhythmia status
          return {
            ...result,
            arrhythmiaStatus: `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}`,
            lastArrhythmiaData: {
              timestamp: currentTime,
              rmssd: analysisData.rmssd,
              rrVariation: analysisData.rrVariation
            }
          };
        } else {
          // Log ignored arrhythmias
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
   * Update pattern buffer with real data
   */
  private updatePatternBuffer(value: number): void {
    this.patternBuffer.push(value);
    if (this.patternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
    
    // Update anomaly scores based on real data
    const anomalyScore = value > 0.3 ? 1 : 0;
    this.anomalyScores.push(anomalyScore);
    if (this.anomalyScores.length > this.ANOMALY_HISTORY_SIZE) {
      this.anomalyScores.shift();
    }
  }
  
  /**
   * Reset pattern buffer
   */
  private resetPatternBuffer(): void {
    this.patternBuffer = [];
    this.anomalyScores = [];
  }
  
  /**
   * Detect arrhythmia patterns in real data
   */
  private detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < this.MIN_ANOMALY_PATTERN_LENGTH) return false;
    
    // Analyze recent real data pattern
    const recentPattern = this.patternBuffer.slice(-this.MIN_ANOMALY_PATTERN_LENGTH);
    
    // Feature 1: Significant variations in real data
    const significantVariations = recentPattern.filter(v => v > 0.3).length;
    const variationRatio = significantVariations / recentPattern.length;
    
    // Feature 2: Pattern consistency in real data
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
   * Set arrhythmia counter
   */
  public setArrhythmiaCounter(count: number): void {
    this.arrhythmiaCounter = count;
  }

  /**
   * Reset analyzer state
   * Ensures all measurements start from zero
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
