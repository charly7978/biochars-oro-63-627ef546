
import { useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';
import { ArrhythmiaProcessor } from '../../modules/arrhythmia-processor';
import { SignalAnalyzer } from '../../modules/signal-analysis/SignalAnalyzer';
import { useArrhythmiaWindows } from './useArrhythmiaWindows';
import { useSignalQualityMonitor } from './useSignalQualityMonitor';
import { useSignalLogger } from './useSignalLogger';
import { VitalSignsProcessorHookReturn } from './types';
import { useVitalSignsState } from './useVitalSignsState';
import { useProcessorRefs } from './useProcessorRefs';

/**
 * Hook for processing vital signs with direct algorithms
 */
export const useVitalSignsProcessor = (): VitalSignsProcessorHookReturn => {
  console.log("DEBUG: useVitalSignsProcessor - Hook initialization start");
  
  // Get state management
  const { lastValidResults, setLastValidResults } = useVitalSignsState();
  console.log("DEBUG: useVitalSignsProcessor - useVitalSignsState initialized", { hasLastResults: !!lastValidResults });
  
  // Get processor references
  const { 
    processorRef, 
    arrhythmiaProcessorRef, 
    sessionId, 
    lastArrhythmiaTimeRef 
  } = useProcessorRefs();
  
  // Compose functionality from smaller hooks
  const { arrhythmiaWindows, addArrhythmiaWindow, resetArrhythmiaWindows } = useArrhythmiaWindows();
  const signalQualityMonitor = useSignalQualityMonitor();
  const signalLogger = useSignalLogger();
  
  console.log("DEBUG: useVitalSignsProcessor - Composed hooks initialized", {
    arrhythmiaWindowsCount: arrhythmiaWindows.length,
    sessionId: sessionId.current
  });
  
  // Initialize processor components
  useEffect(() => {
    console.log("DEBUG: useVitalSignsProcessor - useEffect initialization start");
    
    try {
      console.log("DEBUG: useVitalSignsProcessor - Initializing processor for DIRECT MEASUREMENT", {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      // Create new instances to ensure clean state
      processorRef.current = new VitalSignsProcessor();
      arrhythmiaProcessorRef.current = new ArrhythmiaProcessor();
      
      console.log("DEBUG: useVitalSignsProcessor - Processor instances created successfully", {
        vitalSignsProcessor: !!processorRef.current,
        arrhythmiaProcessor: !!arrhythmiaProcessorRef.current
      });
    } catch (error) {
      console.error("DEBUG: useVitalSignsProcessor - ERROR during processor initialization:", error);
    }
    
    return () => {
      console.log("DEBUG: useVitalSignsProcessor - Processor cleanup", {
        sessionId: sessionId.current,
        totalArrhythmias: arrhythmiaProcessorRef.current?.getArrhythmiaCounter() || 0,
        processedSignals: signalLogger.getProcessedSignals(),
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  const { processSignal, reset, fullReset } = useProcessorMethods(
    processorRef,
    arrhythmiaProcessorRef,
    lastArrhythmiaTimeRef,
    signalQualityMonitor,
    signalLogger,
    setLastValidResults,
    addArrhythmiaWindow,
    resetArrhythmiaWindows
  );
  
  const getArrhythmiaProcessor = useCallback(() => {
    return arrhythmiaProcessorRef.current;
  }, []);

  console.log("DEBUG: useVitalSignsProcessor - Hook initialization completed");

  return {
    processSignal,
    reset,
    fullReset,
    getArrhythmiaProcessor,
    arrhythmiaCounter: arrhythmiaProcessorRef.current?.getArrhythmiaCounter() || 0,
    lastValidResults,
    arrhythmiaWindows,
    debugInfo: {
      processedSignals: signalLogger.getProcessedSignals(),
      signalLog: signalLogger.getSignalLog().slice(-10)
    }
  };
};

// Import the processor methods hook
import { useProcessorMethods } from './useProcessorMethods';
