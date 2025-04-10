import { useRef, useCallback } from 'react';
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';

/**
 * Hook for logging vital signs data
 */
export function useVitalSignsLogging() {
  // Store logs in a ref to avoid re-renders
  const logRef = useRef<{timestamp: number, value: number, result: VitalSignsResult, signalNumber: number}[]>([]);
  const MAX_LOGS = 100;
  
  /**
   * Log signal data along with results
   */
  const logSignalData = useCallback((value: number, result: VitalSignsResult, signalNumber: number) => {
    // Only log every 10th signal to save memory
    if (signalNumber % 10 === 0) {
      const logEntry = {
        timestamp: Date.now(),
        value,
        result,
        signalNumber
      };
      
      logRef.current.push(logEntry);
      
      // Keep the log size limited
      if (logRef.current.length > MAX_LOGS) {
        logRef.current.shift();
      }
      
      // Log to console periodically
      if (signalNumber % 50 === 0) {
        console.log('VitalSignsLog:', {
          signalNumber,
          value,
          spo2: result.spo2,
          pressure: result.pressure,
          arrhythmiaStatus: result.arrhythmiaStatus,
          time: new Date().toISOString()
        });
      }
    }
  }, []);
  
  /**
   * Get all logs
   */
  const getLogs = useCallback(() => {
    return [...logRef.current];
  }, []);
  
  /**
   * Clear all logs
   */
  const clearLog = useCallback(() => {
    logRef.current = [];
  }, []);
  
  return {
    logSignalData,
    getLogs,
    clearLog
  };
}
