
/**
 * Utilidades para manejar la calibración del procesador de signos vitales
 */

/**
 * Inicia el proceso de calibración
 */
export function startCalibration(processor: any): void {
  console.log("useVitalSignsProcessor: Iniciando calibración de todos los parámetros", {
    timestamp: new Date().toISOString(),
    sessionId: Math.random().toString(36).substring(2, 9)
  });
  
  processor.startCalibration();
}

/**
 * Fuerza la finalización del proceso de calibración
 */
export function forceCalibrationCompletion(processor: any): void {
  console.log("useVitalSignsProcessor: Forzando finalización de calibración", {
    timestamp: new Date().toISOString(),
    sessionId: Math.random().toString(36).substring(2, 9)
  });
  
  processor.forceCalibrationCompletion();
}

/**
 * Registra información de procesamiento de señal
 */
export function logSignalProcessing(
  value: number, 
  rrData: any, 
  arrhythmiaCounter: number, 
  processedSignals: number,
  sessionId: string,
  processor: any
): void {
  console.log("useVitalSignsProcessor: Procesando señal", {
    valorEntrada: value,
    rrDataPresente: !!rrData,
    intervalosRR: rrData?.intervals.length || 0,
    ultimosIntervalos: rrData?.intervals.slice(-3) || [],
    contadorArritmias: arrhythmiaCounter,
    señalNúmero: processedSignals,
    sessionId: sessionId,
    timestamp: new Date().toISOString(),
    calibrando: processor.isCurrentlyCalibrating(),
    progresoCalibración: processor.getCalibrationProgress()
  });
}

/**
 * Registra resultados válidos encontrados
 */
export function logValidResults(result: any): void {
  console.log("useVitalSignsProcessor: Resultado válido detectado", {
    spo2: result.spo2,
    presión: result.pressure,
    glucosa: result.glucose,
    lípidos: result.lipids,
    timestamp: new Date().toISOString()
  });
}
