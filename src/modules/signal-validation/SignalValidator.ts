
import { ValidationResult } from './ValidationResult';
import { SignalValidationManager } from './SignalValidationManager';

/**
 * Dedicated module for validating PPG signals using medical-grade standards
 * Provides robust signal validation with strict criteria
 * This class now serves as a facade for the more detailed validation components
 */
export class SignalValidator {
  private validationManager: SignalValidationManager;
  
  constructor() {
    this.validationManager = new SignalValidationManager();
  }
  
  /**
   * Validates signal quality and determines if it meets medical standards
   */
  public validateSignalQuality(
    ppgValue: number,
    signalQuality?: number
  ): ValidationResult {
    return this.validationManager.validateSignalQuality(ppgValue, signalQuality);
  }
  
  /**
   * Validate RR interval data for arrhythmia analysis
   */
  public validateRRIntervals(rrData?: { intervals: number[]; lastPeakTime: number | null }): boolean {
    return this.validationManager.validateRRIntervals(rrData);
  }
  
  /**
   * Reset all validation state
   */
  public reset(): void {
    this.validationManager.reset();
  }
}
