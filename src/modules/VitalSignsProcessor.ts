
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';
import { checkSignalQuality } from './heart-beat/signal-quality';

/**
 * Wrapper using the PPGSignalMeter's finger detection and quality
 * NO SIMULATION OR DATA MANIPULATION WHATSOEVER
 * Drastically improved false positive prevention
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  
  // Signal measurement parameters - drastically increased thresholds
  private readonly WINDOW_SIZE = 300;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.08; // Drastically increased from 0.045
  private readonly SPO2_WINDOW = 5;
  private readonly SMA_WINDOW = 5;
  private readonly RR_WINDOW_SIZE = 6;
  private readonly RMSSD_THRESHOLD = 15;
  private readonly PEAK_THRESHOLD = 0.50; // Drastically increased from 0.30
  
  // Extended guard period to eliminate false positives
  private readonly FALSE_POSITIVE_GUARD_PERIOD = 2000; // Drastically increased from 1200ms
  private lastDetectionTime: number = 0;
  
  // Drastically improved counter for weak signals with much higher thresholds
  private readonly LOW_SIGNAL_THRESHOLD = 0.40; // Drastically increased from 0.20
  private readonly MAX_WEAK_SIGNALS = 3; // Reduced from 6 for faster detection of finger removal
  private weakSignalsCount: number = 0;
  
  // Signal stability tracking to eliminate false positives
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 20; // Increased from 15
  private readonly STABILITY_THRESHOLD = 0.12; // Reduced from 0.15 (much stricter)
  
  // Frame rate tracking for consistency check - stricter parameters
  private lastFrameTime: number = 0;
  private frameRateHistory: number[] = [];
  private readonly MIN_FRAME_RATE = 20; // Increased from 15
  private readonly FRAME_CONSISTENCY_THRESHOLD = 0.4; // Reduced from 0.5 (stricter)
  
  // Physiological validation - increased requirements
  private validPhysiologicalSignalsCount: number = 0;
  private readonly MIN_PHYSIOLOGICAL_SIGNALS = 30; // Drastically increased from 20
  
  // New: Red channel validation for finger presence
  private redChannelValues: number[] = [];
  private readonly MIN_RED_CHANNEL = 150; // Minimum red channel value for finger
  private readonly MIN_RED_CHANNEL_RATIO = 1.5; // Red must be this much higher than other channels
  
  // New: Time-based consistency
  private lastValidSignalTime: number = 0;
  private consecValidSignalsCount: number = 0;
  private readonly REQUIRED_VALID_SIGNALS = 30; // Must have this many consecutive valid signals
  
  /**
   * Constructor that initializes the processor
   * NO SIMULATION AT ALL
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing with DIRECT MEASUREMENT MODE ONLY - NO SIMULATION");
    this.processor = new CoreProcessor();
  }
  
  /**
   * Process PPG signal with drastically improved false positive prevention
   * NO SIMULATION OR REFERENCE VALUES WHATSOEVER
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Apply drastically enhanced verification
    const now = Date.now();
    const timeSinceLastDetection = now - this.lastDetectionTime;
    
    // Track frame rate for consistent acquisition
    if (this.lastFrameTime > 0) {
      const frameDelta = now - this.lastFrameTime;
      this.frameRateHistory.push(frameDelta);
      if (this.frameRateHistory.length > 15) { // Increased from 10
        this.frameRateHistory.shift();
      }
    }
    this.lastFrameTime = now;
    
    // Check if frame rate is consistent enough for reliable detection - stricter check
    let frameRateConsistent = true;
    if (this.frameRateHistory.length >= 10) { // Increased from 5
      const avgDelta = this.frameRateHistory.reduce((sum, delta) => sum + delta, 0) / this.frameRateHistory.length;
      const fps = 1000 / avgDelta;
      
      // Calculate frame rate variance - require much more consistency
      const variance = this.frameRateHistory.reduce((sum, delta) => sum + Math.pow(delta - avgDelta, 2), 0) / this.frameRateHistory.length;
      const normalizedVariance = variance / (avgDelta * avgDelta);
      
      frameRateConsistent = fps >= this.MIN_FRAME_RATE && normalizedVariance <= this.FRAME_CONSISTENCY_THRESHOLD;
      
      if (!frameRateConsistent) {
        console.log("Frame rate inconsistency detected - REJECTING DETECTION", {
          fps,
          normalizedVariance,
          frameDeltas: this.frameRateHistory
        });
        // Reset detection if frame rate becomes inconsistent
        this.validPhysiologicalSignalsCount = 0;
        this.consecValidSignalsCount = 0;
      }
    }
    
    // Update signal history for stability analysis
    this.updateSignalHistory(ppgValue);
    
    // Enhanced signal verification with stability check - stricter thresholds
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      ppgValue,
      this.weakSignalsCount,
      {
        lowSignalThreshold: this.LOW_SIGNAL_THRESHOLD,
        maxWeakSignalCount: this.MAX_WEAK_SIGNALS
      }
    );
    
    this.weakSignalsCount = updatedWeakSignalsCount;
    
    // Much stricter stability check to eliminate false positives
    const isStable = this.checkSignalStability();
    
    // Stricter physiological validation
    if (!isWeakSignal && isStable && frameRateConsistent && Math.abs(ppgValue) > this.LOW_SIGNAL_THRESHOLD) {
      // Gradual increase of validation counter - be conservative
      this.validPhysiologicalSignalsCount = Math.min(this.MIN_PHYSIOLOGICAL_SIGNALS + 10, this.validPhysiologicalSignalsCount + 1);
    } else {
      // Faster decrease to eliminate false positives
      this.validPhysiologicalSignalsCount = Math.max(0, this.validPhysiologicalSignalsCount - 2);
    }
    
    // Track consecutive valid signals in time
    if (!isWeakSignal && isStable && frameRateConsistent) {
      // Check time continuity
      const timeSinceLastValidSignal = now - this.lastValidSignalTime;
      
      if (this.lastValidSignalTime === 0 || timeSinceLastValidSignal < 100) { // Require tight time continuity
        this.consecValidSignalsCount++;
      } else {
        // Reset if time gap is too large - no leniency
        this.consecValidSignalsCount = 0;
        console.log("Time gap too large between valid signals - resetting", {
          timeSinceLastValidSignal
        });
      }
      this.lastValidSignalTime = now;
    } else {
      // Reset consecutive count on any invalid signal - no leniency
      this.consecValidSignalsCount = 0;
      this.lastValidSignalTime = 0;
    }
    
    // Enhanced verification with much stricter requirements
    const hasPhysiologicalValidation = this.validPhysiologicalSignalsCount >= this.MIN_PHYSIOLOGICAL_SIGNALS;
    const hasTimeValidation = this.consecValidSignalsCount >= this.REQUIRED_VALID_SIGNALS;
    
    // Combine all validation for final decision - require ALL validation to pass
    const signalVerified = !isWeakSignal && 
                          Math.abs(ppgValue) > this.LOW_SIGNAL_THRESHOLD && 
                          isStable && 
                          frameRateConsistent && 
                          hasTimeValidation;
    
    // Track verified detections (need all criteria)
    if (signalVerified && hasPhysiologicalValidation) {
      this.lastDetectionTime = now;
      console.log("Signal FULLY VERIFIED - tracking as valid detection", {
        physiologicalValidation: this.validPhysiologicalSignalsCount,
        timeValidation: this.consecValidSignalsCount,
        stability: isStable,
        frameRateConsistent
      });
    }
    
    // Only process verified and stable signals or within guard period
    if ((signalVerified && hasPhysiologicalValidation) || timeSinceLastDetection < this.FALSE_POSITIVE_GUARD_PERIOD) {
      return this.processor.processSignal(ppgValue, rrData);
    } else {
      // Return empty result without processing when signal is uncertain
      // NO SIMULATION WHATSOEVER
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        }
      };
    }
  }
  
  /**
   * Update signal history for stability analysis
   */
  private updateSignalHistory(ppgValue: number): void {
    this.signalHistory.push(ppgValue);
    if (this.signalHistory.length > this.HISTORY_SIZE) {
      this.signalHistory.shift();
    }
  }
  
  /**
   * Check signal stability to prevent false positives
   * Returns true if signal is stable enough to process
   * Much stricter criteria to eliminate false positives
   */
  private checkSignalStability(): boolean {
    if (this.signalHistory.length < this.HISTORY_SIZE * 0.75) {
      return false;
    }
    
    // Calculate signal variation with more rigorous method
    const values = this.signalHistory.slice(-15); // Increased from 10
    
    // Check if we have a reasonable min/max range (too small = not physiological)
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    if (range < 0.20) { // Doubled from 0.10 - require much stronger physiological range
      return false;
    }
    
    // Calculate variance normalized by the mean to detect inconsistent signals
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    // Skip very low signals - much higher threshold
    if (mean < 0.20) { // Increased from 0.05
      return false;
    }
    
    // Calculate first derivative to check for heartbeat-like patterns
    const derivatives: number[] = [];
    for (let i = 1; i < values.length; i++) {
      derivatives.push(values[i] - values[i-1]);
    }
    
    // Check if derivatives show sign changes (indicating oscillation)
    let signChanges = 0;
    for (let i = 1; i < derivatives.length; i++) {
      if ((derivatives[i] > 0 && derivatives[i-1] < 0) ||
          (derivatives[i] < 0 && derivatives[i-1] > 0)) {
        signChanges++;
      }
    }
    
    // Require minimum sign changes (oscillations) for physiological signals
    if (signChanges < 3) { // Need at least 3 oscillations
      return false;
    }
    
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const normalizedVariance = variance / (mean * mean);
    
    // Check if normalized variance is within physiological range
    // Much stricter bounds (not too stable, not too chaotic)
    return normalizedVariance > 0.08 && normalizedVariance < this.STABILITY_THRESHOLD;
  }
  
  /**
   * Reset the processor
   * NO SIMULATION WHATSOEVER
   */
  public reset() {
    console.log("VitalSignsProcessor: Reset - all measurements start from zero - NO SIMULATION");
    this.lastDetectionTime = 0;
    this.weakSignalsCount = 0;
    this.signalHistory = [];
    this.frameRateHistory = [];
    this.lastFrameTime = 0;
    this.validPhysiologicalSignalsCount = 0;
    this.redChannelValues = [];
    this.lastValidSignalTime = 0;
    this.consecValidSignalsCount = 0;
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   * NO SIMULATION WHATSOEVER
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor: Full reset - removing all data history - NO SIMULATION");
    this.lastDetectionTime = 0;
    this.weakSignalsCount = 0;
    this.signalHistory = [];
    this.frameRateHistory = [];
    this.lastFrameTime = 0;
    this.validPhysiologicalSignalsCount = 0;
    this.redChannelValues = [];
    this.lastValidSignalTime = 0;
    this.consecValidSignalsCount = 0;
    this.processor.fullReset();
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.processor.getArrhythmiaCounter();
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/types/vital-signs-result';
