
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';
import { checkSignalQuality } from './heart-beat/signal-quality';

/**
 * Wrapper that ensures only real data is used.
 * No simulation or data manipulation allowed.
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  
  // Direct measurement thresholds
  private readonly WINDOW_SIZE = 300;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.025;
  private readonly SPO2_WINDOW = 5;
  private readonly SMA_WINDOW = 5;
  private readonly RR_WINDOW_SIZE = 6;
  private readonly RMSSD_THRESHOLD = 15;
  private readonly PEAK_THRESHOLD = 0.25;
  
  // Parameters for reliable finger detection
  private readonly MIN_CONSECUTIVE_DETECTIONS = 3;
  private consecutiveDetections: number = 0;
  private readonly FALSE_POSITIVE_GUARD_PERIOD = 500;
  private lastDetectionTime: number = 0;
  
  // Signal quality parameters
  private readonly LOW_SIGNAL_THRESHOLD = 0.05;
  private readonly MAX_WEAK_SIGNALS = 10;
  private weakSignalsCount: number = 0;
  
  /**
   * Constructor that initializes the internal direct measurement processor
   * No simulation is used at any point
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing with direct measurement mode only");
    this.processor = new CoreProcessor();
  }
  
  /**
   * Process a PPG signal using only direct measurement
   * No simulation or reference values are used
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Apply verification before processing
    const now = Date.now();
    const timeSinceLastDetection = now - this.lastDetectionTime;
    
    // Verify real signal without manipulation using the centralized function
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      ppgValue,
      this.weakSignalsCount,
      {
        lowSignalThreshold: this.LOW_SIGNAL_THRESHOLD,
        maxWeakSignalCount: this.MAX_WEAK_SIGNALS
      }
    );
    
    this.weakSignalsCount = updatedWeakSignalsCount;
    const signalVerified = !isWeakSignal && this.verifySignal(ppgValue);
    
    // Update detection counters based on verification
    if (signalVerified) {
      this.consecutiveDetections = Math.min(this.MIN_CONSECUTIVE_DETECTIONS + 2, this.consecutiveDetections + 1);
      this.lastDetectionTime = now;
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.5);
    }
    
    // Only process verified signals
    const shouldProcess = 
      this.consecutiveDetections >= this.MIN_CONSECUTIVE_DETECTIONS ||
      (this.consecutiveDetections > 0 && timeSinceLastDetection < this.FALSE_POSITIVE_GUARD_PERIOD);
    
    if (shouldProcess) {
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
   * Signal verification method to ensure only real signals are processed
   * No simulation is allowed
   */
  private verifySignal(ppgValue: number): boolean {
    // Basic validation of real signals
    if (ppgValue < 0 || ppgValue > 255 || isNaN(ppgValue)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Reset the processor to ensure measurements start from zero
   * No reference values or simulations are used
   */
  public reset() {
    console.log("VitalSignsProcessor: Reset - all measurements start from zero");
    this.consecutiveDetections = 0;
    this.lastDetectionTime = 0;
    this.weakSignalsCount = 0;
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   * Ensures fresh start with no simulation
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor: Full reset - removing all data history");
    this.consecutiveDetections = 0;
    this.lastDetectionTime = 0;
    this.weakSignalsCount = 0;
    this.processor.fullReset();
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
