// Update imports to fix build error
import { signalLogger, SignalLogEntry } from './signal-log/signalLogger';

/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */

export const updateSignalLog = (
  value: number,
  quality: number,
  isFingerDetected: boolean,
  heartRate?: number,
  rmssd?: number
): void => {
  const entry: SignalLogEntry = {
    timestamp: Date.now(),
    value,
    quality,
    isFingerDetected,
    heartRate,
    rmssd
  };
  
  signalLogger.logSignal(entry);
};

export const getSignalLogs = (): SignalLogEntry[] => {
  return signalLogger.getLogs();
};

export const clearSignalLogs = (): void => {
  signalLogger.clear();
};
