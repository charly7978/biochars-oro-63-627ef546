
/**
 * Signal validation utilities for medical applications
 */

/**
 * Validates a signal value against physiological limits
 * to ensure only real measurement data is processed
 */
export function validateSignalValue(value: number): boolean {
  // Check for NaN or Infinity
  if (isNaN(value) || !isFinite(value)) {
    return false;
  }
  
  // Check strict physiological limits
  if (value < 0 || value > 255) {
    return false;
  }
  
  return true;
}

/**
 * Validates vital signs data in result object
 * @param result The result object containing vital signs data
 * @returns A cleaned result object with invalid values reset
 */
export function validateResultData(result: any): any {
  // Deep clone the result to prevent reference issues
  const safeResult = {...result};
  
  // Validate SpO2 field (must be 0-100%)
  if (safeResult.spo2 !== undefined) {
    if (safeResult.spo2 < 0 || safeResult.spo2 > 100) {
      safeResult.spo2 = 0; // Reset invalid values
      console.warn("signalLogUtils: Invalid SpO2 value detected and reset");
    }
  }
  
  // Validate glucose (must be in physiological range)
  if (safeResult.glucose !== undefined && (safeResult.glucose < 0 || safeResult.glucose > 500)) {
    safeResult.glucose = 0;
    console.warn("signalLogUtils: Invalid glucose value detected and reset");
  }
  
  // Validate lipid values
  if (safeResult.lipids) {
    if (safeResult.lipids.totalCholesterol !== undefined && 
        (safeResult.lipids.totalCholesterol < 0 || safeResult.lipids.totalCholesterol > 500)) {
      safeResult.lipids.totalCholesterol = 0;
      console.warn("signalLogUtils: Invalid cholesterol value detected and reset");
    }
    
    if (safeResult.lipids.triglycerides !== undefined && 
        (safeResult.lipids.triglycerides < 0 || safeResult.lipids.triglycerides > 1000)) {
      safeResult.lipids.triglycerides = 0;
      console.warn("signalLogUtils: Invalid triglycerides value detected and reset");
    }
  }
  
  return safeResult;
}
