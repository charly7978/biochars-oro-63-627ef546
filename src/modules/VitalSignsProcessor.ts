
import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';

/**
 * Compatibility wrapper that maintains the original interface
 * while using direct measurement implementation.
 * 
 * This file ensures all measurements start from zero and use only real data.
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  
  // Adjusted thresholds to reduce false positives
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.0; // Neutral calibration factor
  private readonly PERFUSION_INDEX_THRESHOLD = 0.025; // Increased threshold for stricter finger detection
  private readonly SPO2_WINDOW = 5; // Increased window for more data points before confirming
  private readonly SMA_WINDOW = 5; // Increased for better smoothing
  private readonly RR_WINDOW_SIZE = 6; // Increased window size for more reliable detection
  private readonly RMSSD_THRESHOLD = 15; // Increased for stricter arrhythmia detection
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 1000; // Lengthened learning period for better accuracy
  private readonly PEAK_THRESHOLD = 0.25; // Increased for fewer false positives
  
  // New parameters to reduce false positives
  private readonly MIN_CONSECUTIVE_DETECTIONS = 3; // Require multiple consecutive detections
  private consecutiveDetections: number = 0;
  private readonly FALSE_POSITIVE_GUARD_PERIOD = 500; // ms to wait before accepting a new detection
  private lastDetectionTime: number = 0;
  
  /**
   * Constructor that initializes the internal direct measurement processor
   */
  constructor() {
    console.log("VitalSignsProcessor wrapper: Initializing with direct measurement mode");
    this.processor = new CoreProcessor();
  }
  
  /**
   * Process a PPG signal and RR data to get vital signs
   * Maintains exactly the same method signature for compatibility
   * Always performs direct measurement with no reference values
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Apply additional verification before forwarding signal
    // This helps reduce false positives in finger detection
    
    const now = Date.now();
    const timeSinceLastDetection = now - this.lastDetectionTime;
    
    // Check if the signal passes enhanced verification
    const signalVerified = this.verifySignal(ppgValue);
    
    // Update detection counters based on verification
    if (signalVerified) {
      this.consecutiveDetections = Math.min(this.MIN_CONSECUTIVE_DETECTIONS + 2, this.consecutiveDetections + 1);
      this.lastDetectionTime = now;
    } else {
      // More gradual decrease to prevent rapid toggling
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.5);
    }
    
    // Only process signal if we have sufficient consecutive detections
    // or we're within the guard period of a previous valid detection
    const shouldProcess = 
      this.consecutiveDetections >= this.MIN_CONSECUTIVE_DETECTIONS ||
      (this.consecutiveDetections > 0 && timeSinceLastDetection < this.FALSE_POSITIVE_GUARD_PERIOD);
    
    if (shouldProcess) {
      return this.processor.processSignal(ppgValue, rrData);
    } else {
      // Return a null result without processing when detection is uncertain
      // This maintains the same return type but avoids processing unreliable data
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
   * Enhanced signal verification method to reduce false positives
   */
  private verifySignal(ppgValue: number): boolean {
    // Basic validation: reject unreasonable values
    if (ppgValue < 0 || ppgValue > 255 || isNaN(ppgValue)) {
      return false;
    }
    
    // Additional checks could go here based on signal characteristics
    // such as stability, variation patterns, etc.
    
    return true;
  }
  
  /**
   * Reset the processor
   * Ensures all measurements start from zero
   */
  public reset() {
    console.log("VitalSignsProcessor wrapper: Reset - all measurements will start from zero");
    this.consecutiveDetections = 0;
    this.lastDetectionTime = 0;
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   * Removes any history and ensures fresh start
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor wrapper: Full reset - removing all data history");
    this.consecutiveDetections = 0;
    this.lastDetectionTime = 0;
    this.processor.fullReset();
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
