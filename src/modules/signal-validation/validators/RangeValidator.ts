
/**
 * Specialized validator for basic signal range validation
 */
export class RangeValidator {
  /**
   * Validate basic signal range and integrity
   */
  public validateRange(ppgValue: number): { 
    isValid: boolean;
    validationMessage?: string;
  } {
    // Basic range validation
    if (isNaN(ppgValue) || !isFinite(ppgValue) || ppgValue < 0 || Math.abs(ppgValue) > 300) {
      return { 
        isValid: false,
        validationMessage: "Invalid PPG value rejected" 
      };
    }
    
    return { isValid: true };
  }
  
  /**
   * Reset range validator state
   */
  public reset(): void {
    // No state to reset
  }
}
