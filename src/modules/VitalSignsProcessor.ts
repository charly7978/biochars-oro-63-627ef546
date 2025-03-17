
import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';
import { SignalValidator } from './signal-validation/SignalValidator';
import { SignalAnalyzer } from './signal-analysis/SignalAnalyzer';

/**
 * Professional medical-grade wrapper that ensures only real physiological data
 * is processed with strict validation requirements.
 * 
 * This implementation enforces strict medical standards with zero simulation
 * and aggressive false positive prevention.
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  private signalValidator: SignalValidator;
  
  // Strict medical-grade thresholds with zero tolerance for false positives
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.0; // No artificial calibration
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05;
  private readonly SPO2_WINDOW = 8; 
  private readonly SMA_WINDOW = 8;
  private readonly RR_WINDOW_SIZE = 15;
  private readonly RMSSD_THRESHOLD = 22;
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 1200;
  private readonly PEAK_THRESHOLD = 0.45;
  
  // System state
  private readonly WEAK_SIGNAL_THRESHOLD = 0.10;
  private weakSignalCounter: number = 0;
  
  /**
   * Constructor that initializes the internal direct measurement processor
   * with strict medical-grade parameters
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing medical-grade processor with strict validation");
    this.processor = new CoreProcessor();
    this.signalValidator = new SignalValidator();
  }
  
  /**
   * Process a PPG signal and RR data to get vital signs
   * Uses aggressive validation to prevent false readings
   * 
   * @param ppgValue Raw PPG signal value
   * @param rrData Optional RR interval data
   * @returns Validated vital signs or null values if data is insufficient
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null },
    signalQuality?: number
  ): VitalSignsResult {
    // Weak signal detection and rejection
    if (Math.abs(ppgValue) < this.WEAK_SIGNAL_THRESHOLD) {
      this.weakSignalCounter++;
      if (this.weakSignalCounter > 3) {
        console.warn("VitalSignsProcessor: Persistent weak signal detected");
        return SignalAnalyzer.createEmptyResult();
      }
    } else {
      this.weakSignalCounter = 0;
    }
    
    // Multi-stage signal validation
    const validationResult = this.signalValidator.validateSignalQuality(ppgValue, signalQuality);
    
    if (!validationResult.isValid) {
      console.log("VitalSignsProcessor: Signal validation failed", {
        reason: validationResult.validationMessage,
        counter: validationResult.validSampleCounter
      });
      return SignalAnalyzer.createEmptyResult();
    }
    
    // RR interval validation if provided
    if (rrData && !this.signalValidator.validateRRIntervals(rrData)) {
      console.warn("VitalSignsProcessor: Invalid RR intervals");
      return SignalAnalyzer.createEmptyResult();
    }
    
    // Process validated signals
    const result = this.processor.processSignal(ppgValue, rrData);
    
    console.log("VitalSignsProcessor: Processed valid signal with quality", { 
      signalQuality, 
      validSamples: validationResult.validSampleCounter
    });
    
    return result;
  }
  
  /**
   * Reset the processor to ensure a clean state
   */
  public reset() {
    console.log("VitalSignsProcessor: Reset - all measurements will start from zero");
    this.weakSignalCounter = 0;
    this.signalValidator.reset();
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   * Removes any historical influence to prevent data contamination
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor: Full reset - removing all data history");
    this.weakSignalCounter = 0;
    this.signalValidator.reset();
    this.processor.fullReset();
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
