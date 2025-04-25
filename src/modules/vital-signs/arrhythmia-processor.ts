import { ArrhythmiaPatternDetector } from './arrhythmia/pattern-detector';
import { calculateRMSSD, calculateRRVariation } from './arrhythmia/calculations';
import { RRIntervalData, ArrhythmiaProcessingResult } from './arrhythmia/types';

/**
 * Consolidated arrhythmia detection system
 * Using only real data without simulation
 */
export class ArrhythmiaProcessor {
  // Detection thresholds
  private readonly MIN_RR_INTERVALS = 15;
  private readonly MIN_INTERVAL_MS = 500;
  private readonly MAX_INTERVAL_MS = 1500;
  private readonly MIN_VARIATION_PERCENT = 60;
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 15000;
  
  // State
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Arrhythmia confirmation sequence
  private consecutiveAbnormalBeats = 0;
  private readonly CONSECUTIVE_THRESHOLD = 10;
  
  // Pattern detector
  private patternDetector = new ArrhythmiaPatternDetector();

  /**
   * Process real RR data for arrhythmia detection
   */
  public processRRData(rrData?: RRIntervalData): ArrhythmiaProcessingResult {
    const currentTime = Date.now();
    
    // Update RR intervals with real data
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Proceed with sufficient real data
      if (this.rrIntervals.length >= this.MIN_RR_INTERVALS) {
        this.detectArrhythmia(currentTime);
      }
    }

    // Build status message
    const arrhythmiaStatusMessage = 
      this.arrhythmiaCount > 0 
        ? `ARRHYTHMIA DETECTED|${this.arrhythmiaCount}` 
        : `NO ARRHYTHMIAS|${this.arrhythmiaCount}`;
    
    // Additional information if there's active arrhythmia
    const lastArrhythmiaData = this.arrhythmiaDetected 
      ? {
          timestamp: currentTime,
          rmssd: calculateRMSSD(this.rrIntervals.slice(-12)),
          rrVariation: calculateRRVariation(this.rrIntervals.slice(-12))
        } 
      : null;
    
    return {
      arrhythmiaStatus: arrhythmiaStatusMessage,
      lastArrhythmiaData
    };
  }

  /**
   * Algorithm for arrhythmia detection using real data
   */
  private detectArrhythmia(currentTime: number): void {
    if (this.rrIntervals.length < this.MIN_RR_INTERVALS) return;
    
    // Take real intervals for analysis
    const recentRR = this.rrIntervals.slice(-this.MIN_RR_INTERVALS);
    
    // Filter only physiologically valid intervals
    const validIntervals = recentRR.filter(interval => 
      interval >= this.MIN_INTERVAL_MS && interval <= this.MAX_INTERVAL_MS
    );
    
    // Require sufficient valid intervals
    if (validIntervals.length < this.MIN_RR_INTERVALS * 0.75) {
      this.consecutiveAbnormalBeats = 0;
      return;
    }
    
    // Calculate average from real intervals
    const avgRR = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    
    // Get the last real interval
    const lastRR = validIntervals[validIntervals.length - 1];
    
    // Calculate real percentage variation, avoid division by zero
    const variation = avgRR !== 0 ? Math.abs(lastRR - avgRR) / avgRR * 100 : 0;
    
    // Update pattern buffer with real data (normalized variation)
    this.patternDetector.updatePatternBuffer(variation / 100);
    
    // Detect premature beat based on simple variation threshold
    const prematureBeat = variation > this.MIN_VARIATION_PERCENT;
    
    // Update consecutive anomalies counter
    if (prematureBeat) {
      this.consecutiveAbnormalBeats++;
      
      // Log detection (optional - can be uncommented for debugging)
      // console.log("ArrhythmiaProcessor: Possible premature beat detected", {
      //   percentageVariation: variation,
      //   threshold: this.MIN_VARIATION_PERCENT,
      //   consecutive: this.consecutiveAbnormalBeats,
      //   avgRR,
      //   lastRR,
      //   timestamp: currentTime
      // });
    } else {
      // Decrease counter if beat is not premature, but don't go below zero
      this.consecutiveAbnormalBeats = Math.max(0, this.consecutiveAbnormalBeats - 1); 
    }
    
    // Check if arrhythmia should be confirmed
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canDetectNewArrhythmia = timeSinceLastArrhythmia > this.MIN_ARRHYTHMIA_INTERVAL_MS;
    const patternDetected = this.patternDetector.detectArrhythmiaPattern();

    // *** MODIFIED CONFIRMATION LOGIC ***
    // Require pattern detection AND *some* consecutive abnormal beats (e.g., 40% of original threshold)
    const requiredConsecutiveForPattern = Math.max(1, Math.floor(this.CONSECUTIVE_THRESHOLD * 0.4));
    const isArrhythmiaConfirmed = canDetectNewArrhythmia && patternDetected && this.consecutiveAbnormalBeats >= requiredConsecutiveForPattern;
    
    // Original condition (for comparison, now commented out):
    // const isArrhythmiaConfirmed = this.consecutiveAbnormalBeats >= this.CONSECUTIVE_THRESHOLD && canDetectNewArrhythmia && patternDetected;

    if (isArrhythmiaConfirmed) {
      this.arrhythmiaCount++;
      this.arrhythmiaDetected = true; // Mark as detected for the result object
      this.lastArrhythmiaTime = currentTime;
      // Reset counters after confirmation to avoid immediate re-triggering
      this.consecutiveAbnormalBeats = 0; 
      this.patternDetector.resetPatternBuffer(); 
      
      console.log("ArrhythmiaProcessor: ARRHYTHMIA CONFIRMED", {
        arrhythmiaCount: this.arrhythmiaCount,
        requiredConsecutive: requiredConsecutiveForPattern, // Log the threshold used
        actualConsecutive: this.consecutiveAbnormalBeats, // This will be 0 now, log before reset?
        timeSinceLast: timeSinceLastArrhythmia,
        patternDetected: patternDetected, // Log pattern status
        timestamp: currentTime
      });
    } else {
      // If not confirmed, ensure arrhythmiaDetected reflects the current state (it might have been true previously)
      // We only keep arrhythmiaDetected = true for the *moment* of confirmation to populate lastArrhythmiaData
      this.arrhythmiaDetected = false;
    }
  }

  /**
   * Reset the processor
   */
  public reset(): void {
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTime = 0;
    this.startTime = Date.now();
    this.consecutiveAbnormalBeats = 0;
    this.patternDetector.resetPatternBuffer();
    
    console.log("ArrhythmiaProcessor: Processor reset", {
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
}
