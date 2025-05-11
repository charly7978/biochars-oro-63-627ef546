import { useCallback, useRef } from 'react';
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';

export const useVitalSignsLogging = () => {
  const logRef = useRef<Array<{
    timestamp: number;
    ppgValue: number;
    result: VitalSignsResult;
    processedCount: number;
  }>>([]);
  
  const logSignalData = useCallback((
    ppgValue: number,
    result: VitalSignsResult,
    processedCount: number
  ) => {
    // Log data for debugging
    logRef.current.push({
      timestamp: Date.now(),
      ppgValue,
      result,
      processedCount
    });
    
    // Keep log at a reasonable size
    if (logRef.current.length > 100) {
      logRef.current = logRef.current.slice(-100);
    }
    
    return true;
  }, []);
  
  const clearLog = useCallback(() => {
    logRef.current = [];
    return true;
  }, []);
  
  const getLog = useCallback(() => {
    return [...logRef.current];
  }, []);
  
  return {
    logSignalData,
    clearLog,
    getLog,
    logRef
  };
};
