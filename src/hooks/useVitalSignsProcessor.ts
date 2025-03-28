
import { useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { ArrhythmiaProcessor } from '../modules/arrhythmia-processor';
import { SignalAnalyzer } from '../modules/signal-analysis/SignalAnalyzer';
import { useArrhythmiaWindows } from './vital-signs/useArrhythmiaWindows';
import { useSignalQualityMonitor } from './vital-signs/useSignalQualityMonitor';
import { useSignalLogger } from './vital-signs/useSignalLogger';
import { VitalSignsProcessorHookReturn } from './vital-signs/types';
import { useVitalSignsState } from './vital-signs/useVitalSignsState';

/**
 * Hook for processing vital signs with direct algorithms
 */
export const useVitalSignsProcessor = (): VitalSignsProcessorHookReturn => {
  // Get state management
  const { lastValidResults, setLastValidResults } = useVitalSignsState();
  
  // References for internal state
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const arrhythmiaProcessorRef = useRef<ArrhythmiaProcessor | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const lastArrhythmiaTimeRef = useRef<number>(0);
  
  // Compose functionality from smaller hooks
  const { arrhythmiaWindows, addArrhythmiaWindow, resetArrhythmiaWindows } = useArrhythmiaWindows();
  const signalQualityMonitor = useSignalQualityMonitor();
  const signalLogger = useSignalLogger();
  
  // Initialize processor components
  useEffect(() => {
    console.log("useVitalSignsProcessor: Initializing processor for DIRECT MEASUREMENT", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Create new instances to ensure clean state
    processorRef.current = new VitalSignsProcessor();
    arrhythmiaProcessorRef.current = new ArrhythmiaProcessor();
    
    return () => {
      console.log("useVitalSignsProcessor: Processor cleanup", {
        sessionId: sessionId.current,
        totalArrhythmias: arrhythmiaProcessorRef.current?.getArrhythmiaCounter() || 0,
        processedSignals: signalLogger.getProcessedSignals(),
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  /**
   * Process PPG signal directly without simulation or reference values
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult => {
    if (!processorRef.current || !arrhythmiaProcessorRef.current) {
      console.log("useVitalSignsProcessor: Processor not initialized");
      return SignalAnalyzer.createEmptyResult();
    }
    
    // Check signal quality
    const qualityCheck = signalQualityMonitor.checkSignalQuality(value);
    if (qualityCheck.isWeakSignal) {
      return qualityCheck.result;
    }
    
    // Process vital signs
    let result = processorRef.current.processSignal(value, rrData);
    
    // Process arrhythmias if there is enough data and signal is good
    if (rrData && rrData.intervals.length >= 4 && signalQualityMonitor.weakSignalCount() === 0) {
      const arrhythmiaResult = arrhythmiaProcessorRef.current.processRRData(rrData);
      
      // Add arrhythmia status to result
      const formattedArrhythmiaResult = SignalAnalyzer.formatArrhythmiaResult(arrhythmiaResult);
      
      // Update result with arrhythmia data
      result = {
        ...result,
        arrhythmiaStatus: formattedArrhythmiaResult.arrhythmiaStatus
      };
      
      // If new arrhythmia detected, register visualization window
      if (
        arrhythmiaResult.lastArrhythmiaData && 
        arrhythmiaResult.lastArrhythmiaData.timestamp > lastArrhythmiaTimeRef.current
      ) {
        lastArrhythmiaTimeRef.current = arrhythmiaResult.lastArrhythmiaData.timestamp;
        
        // Create arrhythmia window
        const timestamp = arrhythmiaResult.lastArrhythmiaData.timestamp;
        const avgInterval = rrData.intervals.length > 0 
          ? rrData.intervals.reduce((sum, val) => sum + val, 0) / rrData.intervals.length
          : 800;
          
        const windowWidth = Math.max(300, Math.min(1000, avgInterval * 1.2));
        addArrhythmiaWindow(timestamp - windowWidth/2, timestamp + windowWidth/2);
      }
    }
    
    // Log the signal and result
    signalLogger.logSignal(value, result);
    
    // Store the last valid result
    setLastValidResults(result);
    
    return result;
  }, [addArrhythmiaWindow, signalLogger, signalQualityMonitor, setLastValidResults]);

  const reset = useCallback((): void => {
    if (!processorRef.current || !arrhythmiaProcessorRef.current) return;
    
    console.log("useVitalSignsProcessor: Reset initiated");
    
    processorRef.current.reset();
    arrhythmiaProcessorRef.current.reset();
    resetArrhythmiaWindows();
    setLastValidResults(null);
    lastArrhythmiaTimeRef.current = 0;
    signalQualityMonitor.reset();
    
    console.log("useVitalSignsProcessor: Reset completed");
  }, [resetArrhythmiaWindows, signalQualityMonitor, setLastValidResults]);
  
  const fullReset = useCallback((): void => {
    if (!processorRef.current || !arrhythmiaProcessorRef.current) return;
    
    console.log("useVitalSignsProcessor: Full reset initiated");
    
    processorRef.current.fullReset();
    arrhythmiaProcessorRef.current.reset();
    setLastValidResults(null);
    resetArrhythmiaWindows();
    signalLogger.reset();
    lastArrhythmiaTimeRef.current = 0;
    signalQualityMonitor.reset();
    
    console.log("useVitalSignsProcessor: Full reset complete");
  }, [resetArrhythmiaWindows, signalLogger, signalQualityMonitor, setLastValidResults]);

  const getArrhythmiaProcessor = useCallback(() => {
    return arrhythmiaProcessorRef.current;
  }, []);

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
