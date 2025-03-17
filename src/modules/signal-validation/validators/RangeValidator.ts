
import { ValidationResult } from '../ValidationResult';

/**
 * Specialized validator for basic signal range validation with quality assessment
 */
export class RangeValidator {
  private validSampleCounter: number = 0;
  
  /**
   * Validate basic signal range and integrity
   */
  public validateRange(ppgValue: number): ValidationResult {
    // Check for fundamental signal problems
    if (isNaN(ppgValue) || !isFinite(ppgValue)) {
      this.validSampleCounter = 0;
      return { 
        isValid: false,
        validSampleCounter: 0,
        validationMessage: "Invalid PPG value: NaN or infinite" 
      };
    }
    
    // Basic range validation
    if (ppgValue < 0 || Math.abs(ppgValue) > 300) {
      this.validSampleCounter = 0;
      return { 
        isValid: false,
        validSampleCounter: 0,
        validationMessage: "Invalid PPG value: out of range" 
      };
    }
    
    // Validate numerical significance
    if (Math.abs(ppgValue) < 0.005) {
      // Value is too small to be significant
      return {
        isValid: true,
        validSampleCounter: this.validSampleCounter,
        validationMessage: "Weak signal detected"
      };
    }
    
    // Signal is valid, increment counter
    this.validSampleCounter++;
    
    return { 
      isValid: true,
      validSampleCounter: this.validSampleCounter
    };
  }
  
  /**
   * Reset range validator state
   */
  public reset(): void {
    this.validSampleCounter = 0;
  }
}
