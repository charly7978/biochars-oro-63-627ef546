
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
  if (value < -1.0 || value > 350 || Math.abs(value) > 400) { // Límites mucho más ampliados
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
    // SpO2 debe estar entre 0-100, pero permitimos cualquier valor > 0
    if (safeResult.spo2 < 0 || safeResult.spo2 > 100) {
      safeResult.spo2 = 0; // Reiniciar valores inválidos
      console.warn("signalLogUtils: Corrected invalid SpO2 value");
    } else if (safeResult.spo2 > 0 && safeResult.spo2 < 60) {
      // Valores demasiado bajos probablemente son erróneos, pero ahora somos aún más permisivos
      safeResult.spo2 = Math.max(82, safeResult.spo2);
      console.warn("signalLogUtils: Adjusted unrealistically low SpO2 value");
    }
  }
  
  // Validación de glucosa y lípidos con rangos mucho más ampliados
  if (safeResult.glucose !== undefined && (safeResult.glucose < 0 || safeResult.glucose > 800)) {
    safeResult.glucose = 0;
    console.warn("signalLogUtils: Corrected invalid glucose value");
  }
  
  if (safeResult.lipids) {
    if (safeResult.lipids.totalCholesterol !== undefined && 
        (safeResult.lipids.totalCholesterol < 0 || safeResult.lipids.totalCholesterol > 800)) {
      safeResult.lipids.totalCholesterol = 0;
      console.warn("signalLogUtils: Corrected invalid cholesterol value");
    }
    
    if (safeResult.lipids.triglycerides !== undefined && 
        (safeResult.lipids.triglycerides < 0 || safeResult.lipids.triglycerides > 1500)) {
      safeResult.lipids.triglycerides = 0;
      console.warn("signalLogUtils: Corrected invalid triglycerides value");
    }
  }
  
  return safeResult;
}
