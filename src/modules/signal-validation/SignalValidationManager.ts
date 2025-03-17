
import { ValidationResult } from './ValidationResult';
import { AmplitudeValidator } from './validators/AmplitudeValidator';
import { NoiseValidator } from './validators/NoiseValidator';
import { QualityValidator } from './validators/QualityValidator';
import { RangeValidator } from './validators/RangeValidator';
import { RRValidator } from './validators/RRValidator';

/**
 * Central manager for coordinating all signal validation operations
 */
export class SignalValidationManager {
  private amplitudeValidator: AmplitudeValidator;
  private noiseValidator: NoiseValidator;
  private qualityValidator: QualityValidator;
  private rangeValidator: RangeValidator;
  private rrValidator: RRValidator;
  
  private validSampleCounter: number = 0;
  
  constructor() {
    this.amplitudeValidator = new AmplitudeValidator();
    this.noiseValidator = new NoiseValidator();
    this.qualityValidator = new QualityValidator();
    this.rangeValidator = new RangeValidator();
    this.rrValidator = new RRValidator();
  }
  
  /**
   * Validate RR interval data
   */
  public validateRRIntervals(rrData?: { intervals: number[]; lastPeakTime: number | null }): boolean {
    return this.rrValidator.validateRRIntervals(rrData);
  }
  
  /**
   * Validate signal quality through multiple validation stages
   */
  public validateSignalQuality(
    ppgValue: number,
    signalQuality?: number
  ): ValidationResult {
    // Range validation - most basic check
    const rangeResult = this.rangeValidator.validateRange(ppgValue);
    if (!rangeResult.isValid) {
      this.validSampleCounter = 0;
      return {
        isValid: false,
        validSampleCounter: 0,
        validationMessage: rangeResult.validationMessage
      };
    }
    
    // Quality validation if provided
    const qualityResult = this.qualityValidator.validateQuality(signalQuality);
    if (!qualityResult.isValid) {
      this.validSampleCounter = 0;
      return {
        isValid: false,
        validSampleCounter: 0,
        validationMessage: qualityResult.validationMessage
      };
    }
    
    // Noise validation
    const noiseResult = this.noiseValidator.validateNoise(ppgValue);
    if (!noiseResult.isValid) {
      this.validSampleCounter = Math.max(0, this.validSampleCounter - 2);
      return {
        isValid: false,
        validSampleCounter: this.validSampleCounter,
        validationMessage: noiseResult.validationMessage
      };
    }
    
    // Amplitude validation
    const amplitudeResult = this.amplitudeValidator.validateAmplitude(ppgValue);
    if (!amplitudeResult.isValid) {
      this.validSampleCounter = Math.max(0, this.validSampleCounter - 1);
      return {
        isValid: false,
        validSampleCounter: this.validSampleCounter,
        validationMessage: amplitudeResult.validationMessage
      };
    }
    
    // Increment valid sample counter
    this.validSampleCounter++;
    
    // Determine if we have enough consecutive valid samples
    const isFullyValid = this.validSampleCounter >= 8; // Using the CONSECUTIVE_VALID_SAMPLES constant from ValidationConfig
    
    return {
      isValid: isFullyValid,
      validSampleCounter: this.validSampleCounter,
      validationMessage: isFullyValid ? "Valid signal" : "Building confidence"
    };
  }
  
  /**
   * Reset all validators
   */
  public reset(): void {
    this.validSampleCounter = 0;
    this.amplitudeValidator.reset();
    this.noiseValidator.reset();
    this.qualityValidator.reset();
    this.rangeValidator.reset();
    this.rrValidator.reset();
  }
}
