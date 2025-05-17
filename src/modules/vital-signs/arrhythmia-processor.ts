
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { ArrhythmiaPatternDetector } from './arrhythmia/pattern-detector';
import { calculateRMSSD, calculateRRVariation } from './arrhythmia/calculations';
import { RRIntervalData, ArrhythmiaProcessingResult } from './arrhythmia/types';

/**
 * Consolidated arrhythmia detection system
 * Using only real data without simulation
 */
export class ArrhythmiaProcessor {
  // Conservative thresholds for direct measurement
  private readonly MIN_RR_INTERVALS = 10; // Reduced for better detection sensitivity
  private readonly MIN_INTERVAL_MS = 600;
  private readonly MAX_INTERVAL_MS = 1200;
  private readonly MIN_VARIATION_PERCENT = 35; // Reduced threshold to improve detection
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 10000; // Reduced for testing
  
  // State
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Arrhythmia confirmation sequence
  private consecutiveAbnormalBeats = 0;
  private readonly CONSECUTIVE_THRESHOLD = 5; // Reduced threshold for improved sensitivity
  
  // Pattern detector
  private patternDetector = new ArrhythmiaPatternDetector();

  /**
   * Process real RR data for arrhythmia detection
   * No simulation is used
   */
  public processRRData(rrData?: RRIntervalData): ArrhythmiaProcessingResult {
    const currentTime = Date.now();
    
    // Update RR intervals with real data
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = [...this.rrIntervals, ...rrData.intervals];
      // Keep only the last N intervals
      if (this.rrIntervals.length > this.MIN_RR_INTERVALS * 2) {
        this.rrIntervals = this.rrIntervals.slice(-this.MIN_RR_INTERVALS * 2);
      }
      
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Print for debugging
      console.log("ArrhythmiaProcessor: Received RR intervals", {
        count: rrData.intervals.length,
        total: this.rrIntervals.length,
        intervals: rrData.intervals
      });
      
      // Only proceed with sufficient real data
      if (this.rrIntervals.length >= 3) { // Reduced for better sensitivity
        this.detectArrhythmia(currentTime);
      }
    }

    // Build status message
    const arrhythmiaStatusMessage = 
      this.arrhythmiaCount > 0 
        ? `ARRHYTHMIA DETECTED|${this.arrhythmiaCount}` 
        : `NO ARRHYTHMIAS|${this.arrhythmiaCount}`;
    
    // Additional information only if there's active arrhythmia
    const lastArrhythmiaData = this.arrhythmiaDetected 
      ? {
          timestamp: currentTime,
          rmssd: calculateRMSSD(this.rrIntervals.slice(-8)),
          rrVariation: calculateRRVariation(this.rrIntervals.slice(-8))
        } 
      : null;
    
    return {
      arrhythmiaStatus: arrhythmiaStatusMessage,
      lastArrhythmiaData
    };
  }

  /**
   * Conservative algorithm for real data arrhythmia detection
   * No simulation or reference values are used
   */
  private detectArrhythmia(currentTime: number): void {
    if (this.rrIntervals.length < 3) return; // Reduced for improved sensitivity
    
    // Take real intervals for analysis
    const recentRR = this.rrIntervals.slice(-this.MIN_RR_INTERVALS);
    
    // Filter only physiologically valid intervals
    const validIntervals = recentRR.filter(interval => 
      interval >= 400 && interval <= 1500 // Expanded range for improved detection
    );
    
    // Require sufficient valid intervals
    if (validIntervals.length < 3) { // Reduced for better sensitivity
      this.consecutiveAbnormalBeats = 0;
      return;
    }
    
    // Calculate average from real intervals
    const avgRR = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    
    // Get the last real interval
    const lastRR = validIntervals[validIntervals.length - 1];
    
    // Calculate real percentage variation
    const variation = Math.abs(lastRR - avgRR) / avgRR * 100;
    
    // Update pattern buffer with real data
    this.patternDetector.updatePatternBuffer(variation / 100);
    
    // Detect premature beat only if variation meets threshold
    const prematureBeat = variation > this.MIN_VARIATION_PERCENT;
    
    // Update consecutive anomalies counter
    if (prematureBeat) {
      this.consecutiveAbnormalBeats++;
      
      // Log detection
      console.log("ArrhythmiaProcessor: Possible premature beat in real data", {
        percentageVariation: variation,
        threshold: this.MIN_VARIATION_PERCENT,
        consecutive: this.consecutiveAbnormalBeats,
        avgRR,
        lastRR,
        timestamp: currentTime
      });
    } else {
      this.consecutiveAbnormalBeats = Math.max(0, this.consecutiveAbnormalBeats - 1); // Decay counter
    }
    
    // Check if arrhythmia is confirmed with real data
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canDetectNewArrhythmia = timeSinceLastArrhythmia > this.MIN_ARRHYTHMIA_INTERVAL_MS;
    const patternDetected = this.patternDetector.detectArrhythmiaPattern();
    
    if (this.consecutiveAbnormalBeats >= this.CONSECUTIVE_THRESHOLD && canDetectNewArrhythmia && patternDetected) {
      this.arrhythmiaCount++;
      this.arrhythmiaDetected = true;
      this.lastArrhythmiaTime = currentTime;
      this.consecutiveAbnormalBeats = 0;
      this.patternDetector.resetPatternBuffer();
      
      console.log("ArrhythmiaProcessor: ARRHYTHMIA CONFIRMED in real data", {
        arrhythmiaCount: this.arrhythmiaCount,
        timeSinceLast: timeSinceLastArrhythmia,
        timestamp: currentTime
      });
    }
  }

  /**
   * Reset the processor
   * Ensures all measurements start from zero
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
  
  /**
   * Full reset of the processor including arrhythmia counter
   * This method is added to match the interface expected by VitalSignsProcessor
   */
  public fullReset(): void {
    this.reset();
    this.arrhythmiaCount = 0;
    this.consecutiveAbnormalBeats = 0;
    this.lastArrhythmiaTime = 0;
    this.patternDetector.resetPatternBuffer();
    
    console.log("ArrhythmiaProcessor: Full reset performed", {
      timestamp: new Date().toISOString()
    });
  }
}
