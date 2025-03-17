
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
  
  // Verificar límites fisiológicos con mayor permisividad
  if (value < -0.5 || value > 260 || Math.abs(value) > 350) { // Límites ampliados
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
  
  // Validar campos específicos de resultado con mayor permisividad
  if (safeResult.spo2 !== undefined) {
    // SpO2 debe estar entre 0-100
    if (safeResult.spo2 < 0 || safeResult.spo2 > 100) {
      safeResult.spo2 = 0; // Reiniciar valores inválidos
      console.warn("signalLogUtils: Corrected invalid SpO2 value");
    } else if (safeResult.spo2 > 0 && safeResult.spo2 < 70) {
      // Valores demasiado bajos probablemente son erróneos, ajustar a un mínimo más realista
      // pero permitir algunos valores bajos para casos extremos
      safeResult.spo2 = Math.max(85, safeResult.spo2);
      console.warn("signalLogUtils: Adjusted unrealistically low SpO2 value");
    }
  }
  
  // Validación de glucosa y lípidos con rangos ampliados
  if (safeResult.glucose !== undefined && (safeResult.glucose < 0 || safeResult.glucose > 600)) {
    safeResult.glucose = 0;
    console.warn("signalLogUtils: Corrected invalid glucose value");
  }
  
  if (safeResult.lipids) {
    if (safeResult.lipids.totalCholesterol !== undefined && 
        (safeResult.lipids.totalCholesterol < 0 || safeResult.lipids.totalCholesterol > 600)) {
      safeResult.lipids.totalCholesterol = 0;
      console.warn("signalLogUtils: Corrected invalid cholesterol value");
    }
    
    if (safeResult.lipids.triglycerides !== undefined && 
        (safeResult.lipids.triglycerides < 0 || safeResult.lipids.triglycerides > 1200)) {
      safeResult.lipids.triglycerides = 0;
      console.warn("signalLogUtils: Corrected invalid triglycerides value");
    }
  }
  
  return safeResult;
}
