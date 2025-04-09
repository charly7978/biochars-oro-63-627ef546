
/**
 * Consolidated Arrhythmia Detection Service
 * 
 * This service combines the best elements from the existing arrhythmia detection
 * implementations to provide a more consistent and reliable detection.
 */

import { logSignalProcessing, LogLevel } from '@/utils/signalLogging';

export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

export interface ArrhythmiaDetectionResult {
  isArrhythmia: boolean;
  arrhythmiaStatus: string;
  confidence: number;
  rmssd?: number;
  rrVariation?: number;
  timestamp: number;
}

export class ArrhythmiaDetectionService {
  // Unified thresholds based on medical literature and our implementations
  private readonly RMSSD_THRESHOLD = 30;
  private readonly RR_VARIATION_THRESHOLD = 0.20;
  private readonly MIN_RR_INTERVALS = 6; // Reduced for earlier detection
  private readonly MIN_TIME_BETWEEN_ARRHYTHMIAS = 5000; // ms
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.6;
  private readonly LEARNING_PERIOD_MS = 3000;
  private readonly STABILITY_THRESHOLD = 8;
  
  // Pattern detection
  private readonly PATTERN_BUFFER_SIZE = 15;
  private patternBuffer: number[] = [];
  
  // State variables
  private lastArrhythmiaTime: number = 0;
  private arrhythmiaCounter: number = 0;
  private isLearningPhase: boolean = true;
  private measurementStartTime: number = Date.now();
  private stabilityCounter: number = 0;
  private lastRRIntervals: number[] = [];
  private lastIsArrhythmia: boolean = false;
  private currentBeatIsArrhythmia: boolean = false;
  
  // Persisted RR buffer to handle signal interruptions
  private persistedRRIntervals: number[] = [];
  private readonly MAX_PERSISTED_INTERVALS = 30;
  
  // For logging and debugging
  private lastDetectionResult: ArrhythmiaDetectionResult | null = null;
  
  constructor() {
    this.reset();
    console.log("ArrhythmiaDetectionService: Initialized with unified detection parameters");
  }
  
  /**
   * Process RR interval data to detect arrhythmias
   * Uses a combination of RMSSD and RR variation with additional stability requirements
   */
  public detectArrhythmia(rrData?: RRIntervalData): ArrhythmiaDetectionResult {
    const currentTime = Date.now();
    
    // Check if we're in learning phase
    if (this.isLearningPhase && 
        currentTime - this.measurementStartTime > this.LEARNING_PERIOD_MS) {
      this.isLearningPhase = false;
      console.log("ArrhythmiaDetectionService: Learning phase completed");
    }
    
    // Update our persisted intervals with the new data
    this.updatePersistedIntervals(rrData);
    
    // Not enough data for reliable detection
    if (this.persistedRRIntervals.length < this.MIN_RR_INTERVALS) {
      const result: ArrhythmiaDetectionResult = {
        isArrhythmia: false,
        arrhythmiaStatus: "insufficient_data",
        confidence: 0,
        timestamp: currentTime
      };
      
      this.lastDetectionResult = result;
      return result;
    }
    
    // Get recent intervals for analysis
    const intervals = this.persistedRRIntervals.slice(-this.MIN_RR_INTERVALS);
    
    // Calculate key metrics
    const rmssd = this.calculateRMSSD(intervals);
    const rrVariation = this.calculateRRVariation(intervals);
    
    // Update pattern buffer for confirmation
    this.updatePatternBuffer(rrVariation);
    
    // Primary detection logic using both metrics
    const exceedsRMSSDThreshold = rmssd > this.RMSSD_THRESHOLD;
    const exceedsVariationThreshold = rrVariation > this.RR_VARIATION_THRESHOLD;
    
    // Calculate confidence level
    const rmssdFactor = Math.min(rmssd / (this.RMSSD_THRESHOLD * 1.5), 1.0);
    const variationFactor = Math.min(rrVariation / (this.RR_VARIATION_THRESHOLD * 1.5), 1.0);
    const confidence = (rmssdFactor * 0.6) + (variationFactor * 0.4);
    
    // Check for potential arrhythmia
    const isPotentialArrhythmia = 
      (exceedsRMSSDThreshold || exceedsVariationThreshold) && 
      confidence >= this.MIN_CONFIDENCE_THRESHOLD &&
      !this.isLearningPhase;
    
    // Update stability counter
    if (isPotentialArrhythmia) {
      this.stabilityCounter++;
    } else {
      // Gradual decrease for more stability
      this.stabilityCounter = Math.max(0, this.stabilityCounter - 1);
    }
    
    // Check if arrhythmia is confirmed and timing allows new detection
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canDetectNewArrhythmia = timeSinceLastArrhythmia > this.MIN_TIME_BETWEEN_ARRHYTHMIAS;
    const isPatternConfirmed = this.detectArrhythmiaPattern();
    
    // Determine final arrhythmia state
    let isArrhythmia = false;
    
    if (this.stabilityCounter >= this.STABILITY_THRESHOLD && 
        canDetectNewArrhythmia && 
        isPatternConfirmed) {
      
      // Confirmed arrhythmia
      isArrhythmia = true;
      this.arrhythmiaCounter++;
      this.lastArrhythmiaTime = currentTime;
      this.stabilityCounter = Math.max(0, this.stabilityCounter - this.STABILITY_THRESHOLD/2);
      
      // Log this detection
      logSignalProcessing(
        LogLevel.INFO, 
        'ArrhythmiaDetection', 
        `Arrhythmia detected: count=${this.arrhythmiaCounter}, rmssd=${rmssd.toFixed(2)}, variation=${rrVariation.toFixed(2)}`
      );
    }
    
    // Save state for next call
    this.lastIsArrhythmia = this.currentBeatIsArrhythmia;
    this.currentBeatIsArrhythmia = isArrhythmia;
    
    // Create result
    const result: ArrhythmiaDetectionResult = {
      isArrhythmia,
      arrhythmiaStatus: isArrhythmia ? 
        `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}` : 
        `NO ARRHYTHMIAS|${this.arrhythmiaCounter}`,
      confidence,
      rmssd,
      rrVariation,
      timestamp: currentTime
    };
    
    this.lastDetectionResult = result;
    return result;
  }
  
  /**
   * Update the persisted RR intervals buffer with new data
   */
  private updatePersistedIntervals(rrData?: RRIntervalData): void {
    if (!rrData || !rrData.intervals || rrData.intervals.length === 0) {
      return;
    }
    
    // Filter only physiologically plausible intervals (30-240 BPM)
    const validIntervals = rrData.intervals.filter(interval => 
      interval >= 250 && interval <= 2000
    );
    
    // Add all new valid intervals
    this.persistedRRIntervals.push(...validIntervals);
    
    // Save the intervals for next detection
    this.lastRRIntervals = rrData.intervals;
    
    // Trim the buffer to prevent memory issues
    if (this.persistedRRIntervals.length > this.MAX_PERSISTED_INTERVALS) {
      this.persistedRRIntervals = this.persistedRRIntervals.slice(
        -this.MAX_PERSISTED_INTERVALS
      );
    }
  }
  
  /**
   * Update pattern buffer with new variation values
   */
  private updatePatternBuffer(variation: number): void {
    this.patternBuffer.push(variation);
    if (this.patternBuffer.length > this.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
  }
  
  /**
   * Detect arrhythmia patterns in the recent data
   */
  private detectArrhythmiaPattern(): boolean {
    if (this.patternBuffer.length < this.PATTERN_BUFFER_SIZE / 2) {
      return false;
    }
    
    // Get recent pattern data
    const recentPattern = this.patternBuffer.slice(-Math.floor(this.PATTERN_BUFFER_SIZE / 2));
    
    // Count significant variations
    const significantVariations = recentPattern.filter(v => 
      v > this.RR_VARIATION_THRESHOLD * 0.7
    ).length;
    
    // Calculate pattern ratio
    const patternRatio = significantVariations / recentPattern.length;
    
    // Pattern is confirmed if we have enough significant variations
    return patternRatio >= 0.5;
  }
  
  /**
   * Calculate RMSSD (Root Mean Square of Successive Differences)
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sumSquaredDiff = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i - 1];
      sumSquaredDiff += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiff / (intervals.length - 1));
  }
  
  /**
   * Calculate RR variation relative to average
   */
  private calculateRRVariation(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const avgRR = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    if (avgRR === 0) return 0;
    
    const variations = intervals.map(interval => 
      Math.abs(interval - avgRR) / avgRR
    );
    
    return variations.reduce((sum, val) => sum + val, 0) / variations.length;
  }
  
  /**
   * Get current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Get the persisted RR intervals buffer
   */
  public getPersistedIntervals(): number[] {
    return [...this.persistedRRIntervals];
  }
  
  /**
   * Get diagnostic information about the current state
   */
  public getDiagnosticInfo(): any {
    return {
      arrhythmiaCounter: this.arrhythmiaCounter,
      isLearningPhase: this.isLearningPhase,
      stabilityCounter: this.stabilityCounter,
      timeElapsed: Date.now() - this.measurementStartTime,
      persistedIntervalsCount: this.persistedRRIntervals.length,
      lastDetection: this.lastDetectionResult,
      patternBufferSize: this.patternBuffer.length
    };
  }
  
  /**
   * Reset the detection state
   */
  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.arrhythmiaCounter = 0;
    this.isLearningPhase = true;
    this.measurementStartTime = Date.now();
    this.stabilityCounter = 0;
    this.lastRRIntervals = [];
    this.persistedRRIntervals = [];
    this.patternBuffer = [];
    this.lastIsArrhythmia = false;
    this.currentBeatIsArrhythmia = false;
    this.lastDetectionResult = null;
    
    console.log("ArrhythmiaDetectionService: Reset completed");
  }
}
