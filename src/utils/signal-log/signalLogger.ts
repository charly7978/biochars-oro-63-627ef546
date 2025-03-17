
/**
 * Main signal logging utilities that coordinate validation and quality analysis
 */

import { validateSignalValue, validateResultData } from './validateSignal';
import { calculateSignalQuality } from './qualityAnalyzer';

/**
 * Updates the signal log with strict validation, maintaining a manageable size
 * and preventing any simulated or invalid data
 */
export function updateSignalLog(
  signalLog: {timestamp: number, value: number, result: any}[],
  currentTime: number,
  value: number,
  result: any,
  processedSignals: number
): {timestamp: number, value: number, result: any}[] {
  // Validación fisiológica más estricta
  if (!validateSignalValue(value)) {
    console.warn("signalLogUtils: Rejected invalid signal value", { value });
    return signalLog;
  }
  
  if (isNaN(currentTime) || currentTime <= 0) {
    console.warn("signalLogUtils: Rejected invalid timestamp");
    return signalLog;
  }
  
  if (!result) {
    console.warn("signalLogUtils: Rejected null result");
    return signalLog;
  }
  
  // Solo registrar cada X señales para prevenir problemas de memoria
  // Reducida frecuencia para asegurar que no perdamos señales importantes
  if (processedSignals % 10 !== 0) {
    return signalLog;
  }
  
  // Validar y sanear los datos de resultado
  const safeResult = validateResultData(result);
  
  const updatedLog = [
    ...signalLog,
    {
      timestamp: currentTime,
      value,
      result: safeResult
    }
  ];
  
  // Mantener log en tamaño manejable
  const trimmedLog = updatedLog.length > 100 ? updatedLog.slice(-100) : updatedLog;
  
  // Logging mejorado para aplicación médica
  console.log("signalLogUtils: Log updated", {
    totalEntries: trimmedLog.length,
    lastEntry: trimmedLog[trimmedLog.length - 1],
    dataValidated: true,
    signalQuality: calculateSignalQuality(trimmedLog.slice(-20).map(entry => entry.value))
  });
  
  return trimmedLog;
}
