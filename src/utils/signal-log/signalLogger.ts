/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 * 
 * Signal logging utility for medical-grade signals
 */

import { SignalLogEntry } from '../../hooks/vital-signs/types';

/**
 * Updates the signal log with new entry, maintaining a limited buffer size
 */
export function updateSignalLog(
  logEntries: SignalLogEntry[],
  timestamp: number,
  value: number,
  result: any,
  processedCount: number
): SignalLogEntry[] {
  // Create a new log entry
  const entry: SignalLogEntry = {
    timestamp,
    value,
    spo2: result.spo2,
    pressure: result.pressure,
    arrhythmiaStatus: result.arrhythmiaStatus,
    processedCount
  };
  
  // Add new entry to log and keep only the most recent 100 entries
  const updatedLog = [...logEntries, entry];
  if (updatedLog.length > 100) {
    return updatedLog.slice(-100);
  }
  
  return updatedLog;
}

// Make sure to explicitly export the function
export default { updateSignalLog };
