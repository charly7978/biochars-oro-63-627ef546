
import { useCallback } from 'react';
import { ProcessorRefs } from './types';

export function useMonitoringControls(
  processorRef: React.MutableRefObject<any | null>,
  { isMonitoringRef }: ProcessorRefs,
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  lastBeepTimeRef: React.MutableRefObject<number>,
  pendingBeepsQueue: React.MutableRefObject<any[]>,
  consecutiveWeakSignalsRef: React.MutableRefObject<number>,
  beepProcessorTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>,
  cleanupBeepProcessor: () => void,
  setCurrentBPM: React.Dispatch<React.SetStateAction<number>>,
  setConfidence: React.Dispatch<React.SetStateAction<number>>
) {
  // Function to start monitoring
  const startMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Starting monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = true;
      processorRef.current.setMonitoring(true);
      console.log('HeartBeatProcessor: Monitoring state set to true');
      
      // Reset state counters
      lastPeakTimeRef.current = null;
      lastBeepTimeRef.current = 0;
      pendingBeepsQueue.current = [];
      consecutiveWeakSignalsRef.current = 0;
      
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
        beepProcessorTimeoutRef.current = null;
      }
    }
  }, [
    processorRef, 
    isMonitoringRef, 
    lastPeakTimeRef, 
    lastBeepTimeRef, 
    pendingBeepsQueue,
    consecutiveWeakSignalsRef, 
    beepProcessorTimeoutRef
  ]);

  // Function to stop monitoring
  const stopMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Stopping monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = false;
      processorRef.current.setMonitoring(false);
      console.log('HeartBeatProcessor: Monitoring state set to false');
    }
    
    // Clear any pending beeps
    cleanupBeepProcessor();
    
    // Reset BPM values
    setCurrentBPM(0);
    setConfidence(0);
  }, [processorRef, isMonitoringRef, cleanupBeepProcessor, setCurrentBPM, setConfidence]);

  return { startMonitoring, stopMonitoring };
}
