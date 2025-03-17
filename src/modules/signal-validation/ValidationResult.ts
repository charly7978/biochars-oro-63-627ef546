
/**
 * Standard structure for signal validation results
 */
export interface ValidationResult {
  isValid: boolean;
  validSampleCounter: number;
  validationMessage?: string;
}
