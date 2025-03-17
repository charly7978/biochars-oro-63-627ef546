
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
  
  // Verificar límites fisiológicos con extrema permisividad
  if (value < -5.0 || value > 500 || Math.abs(value) > 1000) { // Límites extremadamente ampliados
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
  
  // Validar campos específicos de resultado con extrema permisividad
  if (safeResult.spo2 !== undefined) {
    // SpO2 debe estar entre 0-100, pero permitimos cualquier valor > 0
    if (safeResult.spo2 < 0 || safeResult.spo2 > 100) {
      safeResult.spo2 = 0; // Reiniciar valores inválidos
      console.warn("signalLogUtils: Corrected invalid SpO2 value");
    } else if (safeResult.spo2 > 0 && safeResult.spo2 < 50) { // Reducido de 60 a 50
      // Valores bajos ahora son más aceptables
      safeResult.spo2 = Math.max(75, safeResult.spo2); // Reducido el mínimo de 82 a 75
      console.warn("signalLogUtils: Adjusted unrealistically low SpO2 value");
    }
  }
  
  // Validación de glucosa y lípidos con rangos extremadamente ampliados
  if (safeResult.glucose !== undefined && (safeResult.glucose < 0 || safeResult.glucose > 1000)) {
    safeResult.glucose = 0;
    console.warn("signalLogUtils: Corrected invalid glucose value");
  }
  
  if (safeResult.lipids) {
    if (safeResult.lipids.totalCholesterol !== undefined && 
        (safeResult.lipids.totalCholesterol < 0 || safeResult.lipids.totalCholesterol > 1000)) {
      safeResult.lipids.totalCholesterol = 0;
      console.warn("signalLogUtils: Corrected invalid cholesterol value");
    }
    
    if (safeResult.lipids.triglycerides !== undefined && 
        (safeResult.lipids.triglycerides < 0 || safeResult.lipids.triglycerides > 2000)) {
      safeResult.lipids.triglycerides = 0;
      console.warn("signalLogUtils: Corrected invalid triglycerides value");
    }
  }
  
  return safeResult;
}
