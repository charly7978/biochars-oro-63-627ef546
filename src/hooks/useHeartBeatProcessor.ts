
import { UseHeartBeatReturn } from './heart-beat/types';
import { useBeepProcessor } from './heart-beat/beep-processor';
import { useArrhythmiaDetector } from './heart-beat/arrhythmia-detector';
import { useSignalProcessor } from './heart-beat/signal-processor';
import { useProcessorInitialization } from './heart-beat/processor/init-processor';
import { useProcessorSignalHandling } from './heart-beat/processor/signal-processing';
import { useMonitoringControls } from './heart-beat/processor/monitoring-controls';
import { useProcessorReset } from './heart-beat/processor/reset-processor';
import { useBeepHandler } from './heart-beat/processor/beep-handler';

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  // Initialize the processor and state
  const [processorRef, processorRefs, processorState] = useProcessorInitialization();
  const { currentBPM, setCurrentBPM, confidence, setConfidence } = processorState;
  
  // Import refactored modules
  const { 
    requestImmediateBeep, 
    processBeepQueue, 
    pendingBeepsQueue, 
    lastBeepTimeRef, 
    beepProcessorTimeoutRef, 
    cleanup: cleanupBeepProcessor 
  } = useBeepProcessor();
  
  const {
    detectArrhythmia,
    heartRateVariabilityRef,
    stabilityCounterRef,
    lastRRIntervalsRef,
    lastIsArrhythmiaRef,
    currentBeatIsArrhythmiaRef,
    reset: resetArrhythmiaDetector
  } = useArrhythmiaDetector();
  
  const {
    processSignal: processSignalInternal,
    reset: resetSignalProcessor,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS
  } = useSignalProcessor();

  // Setup beep handler
  const requestBeep = useBeepHandler(
    processorRef,
    requestImmediateBeep,
    processorRefs.isMonitoringRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS,
    processorRefs.missedBeepsCounter
  );

  // Setup signal processing
  const processSignal = useProcessorSignalHandling(
    processorRef,
    currentBPM,
    confidence,
    requestBeep,
    processSignalInternal,
    processorRefs,
    lastRRIntervalsRef,
    currentBeatIsArrhythmiaRef,
    setCurrentBPM,
    setConfidence,
    detectArrhythmia
  );

  // Setup monitoring controls
  const { startMonitoring, stopMonitoring } = useMonitoringControls(
    processorRef,
    processorRefs,
    lastPeakTimeRef,
    lastBeepTimeRef,
    pendingBeepsQueue,
    consecutiveWeakSignalsRef,
    beepProcessorTimeoutRef,
    cleanupBeepProcessor,
    setCurrentBPM,
    setConfidence
  );

  // Setup reset function
  const reset = useProcessorReset(
    processorRef,
    processorRefs,
    resetArrhythmiaDetector,
    resetSignalProcessor,
    cleanupBeepProcessor,
    processorRefs.missedBeepsCounter,
    setCurrentBPM,
    setConfidence
  );

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: currentBeatIsArrhythmiaRef.current,
    requestBeep,
    startMonitoring,
    stopMonitoring
  };
};
