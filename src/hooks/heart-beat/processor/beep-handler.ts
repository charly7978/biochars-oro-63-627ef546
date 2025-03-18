
import { useCallback } from 'react';

export function useBeepHandler(
  processorRef: React.MutableRefObject<any | null>,
  requestImmediateBeep: (
    value: number, 
    isMonitoringRef: React.MutableRefObject<boolean>, 
    lastSignalQualityRef: React.MutableRefObject<number>, 
    consecutiveWeakSignalsRef: React.MutableRefObject<number>, 
    MAX_CONSECUTIVE_WEAK_SIGNALS: number, 
    missedBeepsCounter: React.MutableRefObject<number>, 
    playBeep: (volume?: number) => boolean
  ) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  lastSignalQualityRef: React.MutableRefObject<number>,
  consecutiveWeakSignalsRef: React.MutableRefObject<number>,
  MAX_CONSECUTIVE_WEAK_SIGNALS: number,
  missedBeepsCounter: React.MutableRefObject<number>
) {
  const requestBeep = useCallback((value: number): boolean => {
    if (!processorRef.current) return false;
    
    return requestImmediateBeep(
      value, 
      isMonitoringRef, 
      lastSignalQualityRef, 
      consecutiveWeakSignalsRef, 
      MAX_CONSECUTIVE_WEAK_SIGNALS, 
      missedBeepsCounter, 
      processorRef.current.playBeep.bind(processorRef.current)
    );
  }, [
    processorRef,
    requestImmediateBeep,
    isMonitoringRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS,
    missedBeepsCounter
  ]);

  return requestBeep;
}
