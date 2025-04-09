
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';
import { checkSignalQuality } from './heart-beat/signal-quality';

/**
 * Wrapper using the PPGSignalMeter's finger detection and quality
 * No simulation or data manipulation allowed.
 * Improved resistance to false positives
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  
  // Signal measurement parameters
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045; // Increased from 0.035
  private readonly PEAK_THRESHOLD = 0.30; // Increased from 0.25
  
  // Extended guard period to prevent false positives
  private readonly FALSE_POSITIVE_GUARD_PERIOD = 1200; // Increased from 800ms
  private lastDetectionTime: number = 0;
  
  // Improved counter for weak signals with higher thresholds
  private readonly LOW_SIGNAL_THRESHOLD = 0.20; // Increased from 0.15
  private readonly MAX_WEAK_SIGNALS = 6; // Increased from 5
  private weakSignalsCount: number = 0;
  
  // Signal stability tracking to reduce false positives
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 15; // Increased from 10
  private readonly STABILITY_THRESHOLD = 0.15; // Reduced from 0.2 (more strict)
  
  // Frame rate tracking for consistency check
  private lastFrameTime: number = 0;
  private frameRateHistory: number[] = [];
  private readonly MIN_FRAME_RATE = 15; // Minimum frames per second
  private readonly FRAME_CONSISTENCY_THRESHOLD = 0.5; // Maximum allowed variation in frame times
  
  // Physiological validation
  private validPhysiologicalSignalsCount: number = 0;
  private readonly MIN_PHYSIOLOGICAL_SIGNALS = 20; // Require this many valid signals before accepting
  
  /**
   * Constructor that initializes the processor
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing with direct measurement mode only");
    this.processor = new CoreProcessor();
  }
  
  /**
   * Process a PPG signal with improved false positive detection
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Apply enhanced verification
    const now = Date.now();
    const timeSinceLastDetection = now - this.lastDetectionTime;
    
    // Track frame rate for consistency
    if (this.lastFrameTime > 0) {
      const frameDelta = now - this.lastFrameTime;
      this.frameRateHistory.push(frameDelta);
      if (this.frameRateHistory.length > 10) {
        this.frameRateHistory.shift();
      }
    }
    this.lastFrameTime = now;
    
    // Check if frame rate is consistent enough for reliable detection
    let frameRateConsistent = true;
    if (this.frameRateHistory.length >= 5) {
      const avgDelta = this.frameRateHistory.reduce((sum, delta) => sum + delta, 0) / this.frameRateHistory.length;
      const fps = 1000 / avgDelta;
      
      // Calculate frame rate variance
      const variance = this.frameRateHistory.reduce((sum, delta) => sum + Math.pow(delta - avgDelta, 2), 0) / this.frameRateHistory.length;
      const normalizedVariance = variance / (avgDelta * avgDelta);
      
      frameRateConsistent = fps >= this.MIN_FRAME_RATE && normalizedVariance <= this.FRAME_CONSISTENCY_THRESHOLD;
      
      if (!frameRateConsistent) {
        console.log("Frame rate inconsistency detected - possible false positive condition", {
          fps,
          normalizedVariance,
          frameDeltas: this.frameRateHistory
        });
        // Reset detection if frame rate becomes inconsistent
        this.validPhysiologicalSignalsCount = 0;
      }
    }
    
    // Update signal history for stability analysis
    this.updateSignalHistory(ppgValue);
    
    // Enhanced signal verification with stability check
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      ppgValue,
      this.weakSignalsCount,
      {
        lowSignalThreshold: this.LOW_SIGNAL_THRESHOLD,
        maxWeakSignalCount: this.MAX_WEAK_SIGNALS
      }
    );
    
    this.weakSignalsCount = updatedWeakSignalsCount;
    
    // Additional stability check to prevent false positives
    const isStable = this.checkSignalStability();
    
    // Physiological validation - add more checks for real signals
    if (!isWeakSignal && isStable && frameRateConsistent && Math.abs(ppgValue) > 0) {
      // Signal appears valid from physiological perspective
      this.validPhysiologicalSignalsCount = Math.min(this.MIN_PHYSIOLOGICAL_SIGNALS + 10, this.validPhysiologicalSignalsCount + 1);
    } else {
      // Reduce counter more slowly to maintain stability
      this.validPhysiologicalSignalsCount = Math.max(0, this.validPhysiologicalSignalsCount - 0.5);
    }
    
    // Enhanced verification with stability requirement
    const hasPhysiologicalValidation = this.validPhysiologicalSignalsCount >= this.MIN_PHYSIOLOGICAL_SIGNALS;
    const signalVerified = !isWeakSignal && Math.abs(ppgValue) > 0 && isStable && frameRateConsistent;
    
    if (signalVerified) {
      this.lastDetectionTime = now;
    }
    
    // Only process verified and stable signals or within guard period
    if ((signalVerified && hasPhysiologicalValidation) || timeSinceLastDetection < this.FALSE_POSITIVE_GUARD_PERIOD) {
      return this.processor.processSignal(ppgValue, rrData);
    } else {
      // Return empty result without processing when signal is uncertain
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
   */
  private checkSignalStability(): boolean {
    if (this.signalHistory.length < this.HISTORY_SIZE / 2) {
      return false;
    }
    
    // Calculate signal variation with more rigorous method
    const values = this.signalHistory.slice(-10);
    
    // Check if we have a reasonable min/max range (too small = not physiological)
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    if (range < 0.10) { // Minimum physiological range
      return false;
    }
    
    // Calculate variance normalized by the mean to detect inconsistent signals
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    // Skip very low signals
    if (mean < 0.05) {
      return false;
    }
    
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const normalizedVariance = variance / (mean * mean);
    
    // Check if normalized variance is within physiological range (not too stable, not too chaotic)
    return normalizedVariance > 0.05 && normalizedVariance < this.STABILITY_THRESHOLD;
  }
  
  /**
   * Basic signal verification
   */
  private verifySignal(ppgValue: number): boolean {
    // Basic validation to ensure reasonable values
    if (ppgValue < 0 || ppgValue > 255 || isNaN(ppgValue)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Reset the processor
   */
  public reset() {
    console.log("VitalSignsProcessor: Reset - all measurements start from zero");
    this.lastDetectionTime = 0;
    this.weakSignalsCount = 0;
    this.signalHistory = [];
    this.frameRateHistory = [];
    this.lastFrameTime = 0;
    this.validPhysiologicalSignalsCount = 0;
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor: Full reset - removing all data history");
    this.lastDetectionTime = 0;
    this.weakSignalsCount = 0;
    this.signalHistory = [];
    this.frameRateHistory = [];
    this.lastFrameTime = 0;
    this.validPhysiologicalSignalsCount = 0;
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
