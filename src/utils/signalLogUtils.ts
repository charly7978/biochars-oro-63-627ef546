
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
  // Increased sampling interval for more efficient memory usage
  if (processedSignals % 30 !== 0) {
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
  // Reduced log size to improve performance
  const trimmedLog = updatedLog.length > 40 ? updatedLog.slice(-40) : updatedLog;
  
  // Enhanced logging with detection information
  const fingerDetected = result.fingerDetected ? "SI" : "NO";
  const quality = result.quality || 0;
  
  console.log(`SignalLog: Calidad: ${quality}, Dedo: ${fingerDetected}, Valor: ${Math.round(value)}`);
  
  return trimmedLog;
}

/**
 * Analiza un registro de señales para detectar falsos positivos
 * @param signalLog Registro de señales a analizar
 * @returns Información de análisis
 */
export function analyzeSignalLog(
  signalLog: {timestamp: number, value: number, result: any}[]
): { falsePositives: number, stability: number } {
  if (signalLog.length < 10) {
    return { falsePositives: 0, stability: 0 };
  }
  
  // Detectar cambios rápidos en la detección (posibles falsos positivos)
  let detectionChanges = 0;
  let lastDetection = false;
  
  signalLog.forEach(entry => {
    const currentDetection = entry.result.fingerDetected;
    if (currentDetection !== lastDetection) {
      detectionChanges++;
      lastDetection = currentDetection;
    }
  });
  
  // Calcular estabilidad de la señal
  const values = signalLog.map(entry => entry.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stability = Math.max(0, 100 - Math.min(100, variance));
  
  return {
    falsePositives: detectionChanges / 2, // Approximate count
    stability
  };
}
