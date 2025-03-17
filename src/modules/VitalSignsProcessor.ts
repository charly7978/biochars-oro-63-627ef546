
import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';

/**
 * Compatibility wrapper that maintains the original interface
 * while using direct measurement implementation.
 * 
 * This file ensures all measurements start from zero and use only real data.
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  
  // Set wider thresholds to accommodate more physiological variations
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.0; // Neutral calibration factor
  private readonly PERFUSION_INDEX_THRESHOLD = 0.015; // Lowered threshold for greater sensitivity
  private readonly SPO2_WINDOW = 3; // Shortened for faster initial response
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5; // Reduced window size for faster response
  private readonly RMSSD_THRESHOLD = 12; // Lowered for better arrhythmia detection
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 800; // Shortened learning period
  private readonly PEAK_THRESHOLD = 0.15; // Lowered for greater sensitivity
  private readonly RENDER_OPTIMIZATION = true; // Enable rendering optimizations
  
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
    // Direct processing with no adjustments or simulations
    return this.processor.processSignal(ppgValue, rrData);
  }
  
  /**
   * Reset the processor
   * Ensures all measurements start from zero
   */
  public reset() {
    console.log("VitalSignsProcessor wrapper: Reset - all measurements will start from zero");
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   * Removes any history and ensures fresh start
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor wrapper: Full reset - removing all data history");
    this.processor.fullReset();
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
