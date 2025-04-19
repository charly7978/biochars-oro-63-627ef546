
import { useCallback, useRef } from 'react';
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';

interface SignalLog {
  timestamp: number;
  value: number;
  result: any;
}

/**
 * Hook para registro de señales vitales y depuración
 */
export const useSignalLogging = () => {
  const signalLog = useRef<SignalLog[]>([]);
  const MAX_LOG_LENGTH = 100;
  
  /**
   * Registrar una señal y su resultado
   */
  const logSignal = useCallback((value: number, result: VitalSignsResult): void => {
    signalLog.current.push({
      timestamp: Date.now(),
      value,
      result
    });
    
    // Mantener el registro a un tamaño manejable
    if (signalLog.current.length > MAX_LOG_LENGTH) {
      signalLog.current.shift();
    }
  }, []);
  
  /**
   * Obtener el registro de señales
   */
  const getSignalLog = useCallback((): SignalLog[] => {
    return [...signalLog.current];
  }, []);
  
  /**
   * Limpiar el registro
   */
  const clearLog = useCallback((): void => {
    signalLog.current = [];
  }, []);
  
  return {
    logSignal,
    getSignalLog,
    clearLog
  };
};
