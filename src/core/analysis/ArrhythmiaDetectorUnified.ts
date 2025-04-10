
import { VitalSignsConfig } from '../config/VitalSignsConfig';
import { calculateRMSSD, calculateRRVariation, calculatePNN50 } from '../../modules/vital-signs/arrhythmia/calculations';
import { ArrhythmiaPatternDetector } from '../../modules/vital-signs/arrhythmia/pattern-detector';
import { ArrhythmiaPattern } from '../../modules/vital-signs/arrhythmia/types';

export interface ArrhythmiaResult {
  isArrhythmia: boolean;
  rmssd: number;
  rrVariation: number;
  confidence: number;
  pattern?: ArrhythmiaPattern;
}

export interface ArrhythmiaProcessingResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

/**
 * Unified arrhythmia detector that combines detection methods
 * from multiple implementations
 */
export class ArrhythmiaDetectorUnified {
  // Detection thresholds
  private rmssdThreshold: number = VitalSignsConfig.arrhythmia.THRESHOLDS.RMSSD; 
  private rrVariationThreshold: number = VitalSignsConfig.arrhythmia.THRESHOLDS.RR_VARIATION;
  private minTimeBetweenArrhythmias: number = VitalSignsConfig.arrhythmia.TIMING.MIN_TIME_BETWEEN_ARRHYTHMIAS;
  private consecutiveThreshold: number = VitalSignsConfig.arrhythmia.DATA.CONSECUTIVE_THRESHOLD;
  private requiredRRIntervals: number = VitalSignsConfig.arrhythmia.DATA.REQUIRED_RR_INTERVALS;
  
  // State tracking
  private lastArrhythmiaTime: number = 0;
  private arrhythmiaCount: number = 0;
  private consecutiveArrhythmias: number = 0;
  private lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null = null;
  
  private patternDetector: ArrhythmiaPatternDetector;
  
  constructor() {
    this.patternDetector = new ArrhythmiaPatternDetector();
  }
  
  /**
   * Process RR interval data to detect arrhythmias
   */
  public processRRData(rrData: { intervals: number[], lastPeakTime: number | null }): ArrhythmiaProcessingResult {
    const { intervals, lastPeakTime } = rrData;
    
    // Check if we have enough intervals for analysis
    if (intervals.length < this.requiredRRIntervals || !lastPeakTime) {
      return {
        arrhythmiaStatus: "NORMAL",
        lastArrhythmiaData: this.lastArrhythmiaData
      };
    }
    
    // Calculate heart rate variability metrics
    const rmssd = calculateRMSSD(intervals.slice(-5));
    const rrVariation = calculateRRVariation(intervals.slice(-5));
    
    // Update pattern detector with normalized variability
    this.patternDetector.updatePatternBuffer(rrVariation);
    
    // Check for arrhythmia based on thresholds
    const isRmssdHigh = rmssd > this.rmssdThreshold;
    const isRrVariationHigh = rrVariation > this.rrVariationThreshold;
    
    // Combined condition
    const isArrhythmia = isRmssdHigh && isRrVariationHigh;
    
    // Track consecutive arrhythmias for stability
    if (isArrhythmia) {
      this.consecutiveArrhythmias++;
    } else {
      this.consecutiveArrhythmias = Math.max(0, this.consecutiveArrhythmias - 1);
    }
    
    // Check time since last reported arrhythmia to avoid duplicates
    const now = Date.now();
    const timeSinceLastArrhythmia = now - this.lastArrhythmiaTime;
    
    // Only report arrhythmia if enough consecutive detections and time passed
    let arrhythmiaStatus = "NORMAL";
    
    if (this.consecutiveArrhythmias >= this.consecutiveThreshold && 
        timeSinceLastArrhythmia >= this.minTimeBetweenArrhythmias) {
      
      // Check pattern to confirm it's a real arrhythmia
      const patternDetected = this.patternDetector.detectArrhythmiaPattern();
      
      if (patternDetected) {
        this.lastArrhythmiaTime = now;
        this.arrhythmiaCount++;
        
        // Update last arrhythmia data
        this.lastArrhythmiaData = {
          timestamp: now,
          rmssd,
          rrVariation
        };
        
        arrhythmiaStatus = `ARRHYTHMIA DETECTED|${this.arrhythmiaCount}`;
        console.log("ArrhythmiaDetectorUnified: Arrhythmia detected!", { 
          rmssd, 
          rrVariation, 
          count: this.arrhythmiaCount 
        });
      }
    }
    
    return {
      arrhythmiaStatus,
      lastArrhythmiaData: this.lastArrhythmiaData
    };
  }
  
  /**
   * Analyze RR intervals and return detailed result
   */
  public analyzeRRIntervals(intervals: number[]): ArrhythmiaResult {
    if (intervals.length < this.requiredRRIntervals) {
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        confidence: 0
      };
    }
    
    // Calculate metrics
    const rmssd = calculateRMSSD(intervals);
    const rrVariation = calculateRRVariation(intervals);
    const pnn50 = calculatePNN50(intervals);
    
    // Check thresholds with some hysteresis
    const isHighRMSSD = rmssd > this.rmssdThreshold;
    const isHighVariation = rrVariation > this.rrVariationThreshold;
    
    // Combined detection
    const isArrhythmia = isHighRMSSD && isHighVariation;
    
    // Calculate confidence based on how far above threshold
    let confidence = 0;
    if (isArrhythmia) {
      const rmssdFactor = Math.min(1, (rmssd - this.rmssdThreshold) / (this.rmssdThreshold * 0.5));
      const variationFactor = Math.min(1, (rrVariation - this.rrVariationThreshold) / (this.rrVariationThreshold * 0.5));
      
      confidence = (rmssdFactor * 0.6) + (variationFactor * 0.4);
    }
    
    return {
      isArrhythmia,
      rmssd,
      rrVariation,
      confidence: Math.min(1, confidence)
    };
  }
  
  /**
   * Get arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Reset detector state
   */
  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.arrhythmiaCount = 0;
    this.consecutiveArrhythmias = 0;
    this.lastArrhythmiaData = null;
    this.patternDetector.resetPatternBuffer();
  }
  
  /**
   * Set custom thresholds
   */
  public setThresholds(options: {
    rmssdThreshold?: number;
    rrVariationThreshold?: number;
    minTimeBetweenArrhythmias?: number;
    consecutiveThreshold?: number;
    requiredRRIntervals?: number;
  }): void {
    if (options.rmssdThreshold !== undefined) {
      this.rmssdThreshold = options.rmssdThreshold;
    }
    if (options.rrVariationThreshold !== undefined) {
      this.rrVariationThreshold = options.rrVariationThreshold;
    }
    if (options.minTimeBetweenArrhythmias !== undefined) {
      this.minTimeBetweenArrhythmias = options.minTimeBetweenArrhythmias;
    }
    if (options.consecutiveThreshold !== undefined) {
      this.consecutiveThreshold = options.consecutiveThreshold;
    }
    if (options.requiredRRIntervals !== undefined) {
      this.requiredRRIntervals = options.requiredRRIntervals;
    }
  }
}
