
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */

import { ValidationResult } from './ValidationResult';
import { SignalValidationManager } from './SignalValidationManager';
import { RangeValidator } from './validators/RangeValidator';

/**
 * Dedicated module for validating genuine PPG signals using medical-grade standards
 * Provides robust signal validation with strict criteria
 * This class serves as a facade for the validation components
 */
export class SignalValidator {
  private validationManager: SignalValidationManager;
  private rangeValidator: RangeValidator;
  
  constructor() {
    this.validationManager = new SignalValidationManager();
    this.rangeValidator = new RangeValidator();
  }
  
  /**
   * Validates signal quality and determines if it meets medical standards
   * Fast path validation using the enhanced range validator
   * Processes only real signals without simulation
   */
  public validateSignalQuality(
    ppgValue: number,
    signalQuality?: number
  ): ValidationResult {
    // First, do a quick range validation check
    const rangeResult = this.rangeValidator.validateRange(ppgValue);
    
    // If the basic range check fails, no need to continue
    if (!rangeResult.isValid) {
      return rangeResult;
    }
    
    // For more detailed validation, use the validation manager
    return this.validationManager.validateSignalQuality(ppgValue, signalQuality);
  }
  
  /**
   * Validate RR interval data for arrhythmia analysis
   * Ensures only genuine physiological data is processed
   */
  public validateRRIntervals(rrData?: { intervals: number[]; lastPeakTime: number | null }): boolean {
    return this.validationManager.validateRRIntervals(rrData);
  }
  
  /**
   * Reset all validation state
   */
  public reset(): void {
    this.rangeValidator.reset();
    this.validationManager.reset();
  }
}
