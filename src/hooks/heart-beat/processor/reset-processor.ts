
import { useCallback } from 'react';
import { ProcessorRefs } from './types';

export function useProcessorReset(
  processorRef: React.MutableRefObject<any | null>,
  { isMonitoringRef, sessionId }: ProcessorRefs,
  resetArrhythmiaDetector: () => void,
  resetSignalProcessor: () => void,
  cleanupBeepProcessor: () => void,
  missedBeepsCounter: React.MutableRefObject<number>,
  setCurrentBPM: React.Dispatch<React.SetStateAction<number>>,
  setConfidence: React.Dispatch<React.SetStateAction<number>>
) {
  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Resetting processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      // Turn off monitoring first
      processorRef.current.setMonitoring(false);
      isMonitoringRef.current = false;
      
      // Then reset the processor
      processorRef.current.reset();
      processorRef.current.initAudio();
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    
    // Reset all submodules
    resetArrhythmiaDetector();
    resetSignalProcessor();
    
    missedBeepsCounter.current = 0;
    
    // Clear any pending beeps
    cleanupBeepProcessor();
  }, [
    processorRef,
    isMonitoringRef,
    sessionId,
    resetArrhythmiaDetector,
    resetSignalProcessor,
    cleanupBeepProcessor,
    missedBeepsCounter,
    setCurrentBPM,
    setConfidence
  ]);

  return reset;
}
