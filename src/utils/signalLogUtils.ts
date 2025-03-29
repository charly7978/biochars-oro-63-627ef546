
/**
 * Utilidades para el registro y análisis de señales
 */

/**
 * Actualiza el registro de señales, manteniendo un tamaño manejable
 */
export function updateSignalLog(
  signalLog: {timestamp: number, value: number, result: any}[],
  currentTime: number,
  value: number,
  result: any,
  processedSignals: number
): {timestamp: number, value: number, result: any}[] {
  // Solo registrar cada X señales para no sobrecargar la memoria
  if (processedSignals % 20 !== 0) {
    return signalLog;
  }
  
  const updatedLog = [
    ...signalLog,
    {
      timestamp: currentTime,
      value,
      result: {...result}
    }
  ];
  
  // Mantener el log a un tamaño manejable
  const trimmedLog = updatedLog.length > 50 ? updatedLog.slice(-50) : updatedLog;
  
  // Registrar para depuración
  console.log("useVitalSignsProcessor: Log de señales", {
    totalEntradas: trimmedLog.length,
    ultimasEntradas: trimmedLog.slice(-3)
  });
  
  return trimmedLog;
}
