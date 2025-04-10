
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef } from 'react';
import { updateSignalLog } from '../../utils/signalLogUtils';
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';

/**
 * Hook for logging vital signs data
 * Used with real data only
 */
export const useVitalSignsLogging = () => {
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  /**
   * Update the signal log with new data
   */
  const logSignalData = (
    value: number, 
    result: VitalSignsResult, 
    processedSignalCount: number
  ) => {
    const currentTime = Date.now();
    signalLog.current = updateSignalLog(
      signalLog.current, 
      currentTime, 
      value, 
      result, 
      processedSignalCount
    );
    
    // Log processed signals periodically
    if (processedSignalCount % 100 === 0) {
      console.log("useVitalSignsProcessor: Processing status with real data", {
        processed: processedSignalCount,
        pressure: result.pressure,
        spo2: result.spo2,
        glucose: result.glucose,
        hasValidBP: result.pressure !== "--/--"
      });
    }
  };
  
  /**
   * Clear the signal log
   */
  const clearLog = () => {
    signalLog.current = [];
  };
  
  /**
   * Get the current signal log
   */
  const getSignalLog = () => {
    return signalLog.current.slice(-10);
  };
  
  return {
    logSignalData,
    clearLog,
    getSignalLog,
    signalLog
  };
};
