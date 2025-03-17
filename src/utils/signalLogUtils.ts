
/**
 * Utilidades para el registro y análisis de señales
 * Optimizado para mejor rendimiento
 */

/**
 * Actualiza el registro de señales, manteniendo un tamaño manejable
 * Implementación optimizada para rendimiento
 */
export function updateSignalLog(
  signalLog: {timestamp: number, value: number, result: any}[],
  currentTime: number,
  value: number,
  result: any,
  processedSignals: number
): {timestamp: number, value: number, result: any}[] {
  // Solo registrar cada X señales para reducir carga de procesamiento
  // Incrementado para mejorar rendimiento
  if (processedSignals % 30 !== 0) {
    return signalLog;
  }
  
  // Usar Array.push para mejor rendimiento que spread operator
  const updatedLog = signalLog.slice();
  updatedLog.push({
    timestamp: currentTime,
    value,
    result: {...result}
  });
  
  // Mantener el log a un tamaño manejable
  // Usar slice directo es más eficiente
  const trimmedLog = updatedLog.length > 40 ? updatedLog.slice(-40) : updatedLog;
  
  // Log menos frecuente para mejorar rendimiento
  if (processedSignals % 150 === 0) {
    console.log("useVitalSignsProcessor: Log de señales", {
      totalEntradas: trimmedLog.length,
      ultimasEntradas: trimmedLog.slice(-2)
    });
  }
  
  return trimmedLog;
}

/**
 * Optimiza el manejo de datos para renderizado eficiente
 * @param data Datos a procesar
 * @param maxPoints Número máximo de puntos a mantener
 * @returns Datos optimizados
 */
export function optimizeRenderData<T>(data: T[], maxPoints: number = 120): T[] {
  if (data.length <= maxPoints) return data;
  
  // Estrategia de diezmado para mantener puntos críticos
  const stride = Math.ceil(data.length / maxPoints);
  const result: T[] = [];
  
  for (let i = 0; i < data.length; i += stride) {
    result.push(data[i]);
  }
  
  return result;
}
