
import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';
import { SignalValidator } from './signal-validation/SignalValidator';
import { SignalAnalyzer } from './signal-analysis/SignalAnalyzer';
import { ProcessorConfig } from './vital-signs/ProcessorConfig';

/**
 * Professional medical-grade wrapper that ensures only real physiological data
 * is processed with strict validation requirements.
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  private signalValidator: SignalValidator;
  
  // System state
  private weakSignalCounter: number = 0;
  
  /**
   * Constructor that initializes the processor with strict validation
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing processor with strict validation");
    this.processor = new CoreProcessor();
    this.signalValidator = new SignalValidator();
  }
  
  /**
   * Process a PPG signal to get vital signs with strict validation
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
    // Validate weak signal
    if (Math.abs(ppgValue) < ProcessorConfig.WEAK_SIGNAL_THRESHOLD) {
      this.weakSignalCounter++;
      if (this.weakSignalCounter > 3) {
        console.warn("VitalSignsProcessor: Weak signal detected");
        return SignalAnalyzer.createEmptyResult();
      }
    } else {
      this.weakSignalCounter = 0;
    }
    
    // Validate signal quality
    const validationResult = this.signalValidator.validateSignalQuality(ppgValue, signalQuality);
    
    if (!validationResult.isValid) {
      console.log("VitalSignsProcessor: Signal validation failed", {
        reason: validationResult.validationMessage,
        counter: validationResult.validSampleCounter
      });
      return SignalAnalyzer.createEmptyResult();
    }
    
    // Validate RR intervals
    if (rrData && !this.signalValidator.validateRRIntervals(rrData)) {
      console.warn("VitalSignsProcessor: Invalid RR intervals");
      return SignalAnalyzer.createEmptyResult();
    }
    
    // Process valid signals only
    const result = this.processor.processSignal(ppgValue, rrData);
    
    console.log("VitalSignsProcessor: Processed valid signal", { 
      signalQuality, 
      validSamples: validationResult.validSampleCounter
    });
    
    return result;
  }
  
  /**
   * Reset the processor state
   */
  public reset() {
    console.log("VitalSignsProcessor: Reset processor state");
    this.weakSignalCounter = 0;
    this.signalValidator.reset();
    return this.processor.reset();
  }
  
  /**
   * Complete reset of processor and data
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor: Full reset of all data");
    this.weakSignalCounter = 0;
    this.signalValidator.reset();
    this.processor.fullReset();
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
