
import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';

/**
 * Compatibility wrapper that maintains the original interface
 * while using the refactored implementation.
 * 
 * This file is crucial for maintaining compatibility with existing code
 * while we improve the internal structure.
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  
  // Set wider thresholds to accommodate more physiological variations
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.0; // Removed calibration bias (formerly 1.05)
  private readonly PERFUSION_INDEX_THRESHOLD = 0.03; // Lowered threshold for greater sensitivity
  private readonly SPO2_WINDOW = 5; // Shortened for faster initial response
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 20; // Lowered for better arrhythmia detection
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 2000; // Shortened learning period
  private readonly PEAK_THRESHOLD = 0.25; // Lowered for greater sensitivity
  
  /**
   * Constructor that initializes the internal refactored processor
   */
  constructor() {
    this.processor = new CoreProcessor();
  }
  
  /**
   * Process a PPG signal and RR data to get vital signs
   * Maintains exactly the same method signature for compatibility
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    return this.processor.processSignal(ppgValue, rrData);
  }
  
  /**
   * Reset the processor
   */
  public reset() {
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   */
  public fullReset(): void {
    this.processor.fullReset();
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
