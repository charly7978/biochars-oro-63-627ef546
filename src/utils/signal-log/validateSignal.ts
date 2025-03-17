
/**
 * Core signal validation utilities for medical-grade applications
 */

/**
 * Validates a signal value against physiological limits
 * to prevent false data from being processed
 */
export function validateSignalValue(value: number): boolean {
  // Verificar NaN o Infinity
  if (isNaN(value) || !isFinite(value)) {
    return false;
  }
  
  // Verificar límites fisiológicos con mayor precisión
  if (value < 0 || value > 255 || Math.abs(value) > 300) {
    return false;
  }
  
  return true;
}

/**
 * Validates specific vital signs data in result object
 * @param result The result object containing vital signs data
 * @returns A cleaned result object with invalid values reset
 */
export function validateResultData(result: any): any {
  // Clonar profundamente el resultado para prevenir problemas de referencia
  const safeResult = {...result};
  
  // Validar campos específicos de resultado
  if (safeResult.spo2 !== undefined) {
    // SpO2 debe estar entre 0-100
    if (safeResult.spo2 < 0 || safeResult.spo2 > 100) {
      safeResult.spo2 = 0; // Reiniciar valores inválidos
      console.warn("signalLogUtils: Corrected invalid SpO2 value");
    }
  }
  
  // Validación de glucosa y lípidos
  if (safeResult.glucose !== undefined && (safeResult.glucose < 0 || safeResult.glucose > 500)) {
    safeResult.glucose = 0;
    console.warn("signalLogUtils: Corrected invalid glucose value");
  }
  
  if (safeResult.lipids) {
    if (safeResult.lipids.totalCholesterol !== undefined && 
        (safeResult.lipids.totalCholesterol < 0 || safeResult.lipids.totalCholesterol > 500)) {
      safeResult.lipids.totalCholesterol = 0;
      console.warn("signalLogUtils: Corrected invalid cholesterol value");
    }
    
    if (safeResult.lipids.triglycerides !== undefined && 
        (safeResult.lipids.triglycerides < 0 || safeResult.lipids.triglycerides > 1000)) {
      safeResult.lipids.triglycerides = 0;
      console.warn("signalLogUtils: Corrected invalid triglycerides value");
    }
  }
  
  return safeResult;
}
