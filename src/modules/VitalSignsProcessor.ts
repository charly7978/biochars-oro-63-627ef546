
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
  
  // Expose original constants for compatibility
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.05; // Increased from 1.02 to 1.05 for better calibration
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045; // Reduced from 0.05 to 0.045 for greater sensitivity
  private readonly SPO2_WINDOW = 8; // Reduced from 10 to 8 for faster response
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 22; // Reduced from 25 to 22 for better arrhythmia detection
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 2500; // Reduced from 3000 to 2500 ms
  private readonly PEAK_THRESHOLD = 0.28; // Reduced from 0.3 to 0.28 for greater sensitivity
  
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
