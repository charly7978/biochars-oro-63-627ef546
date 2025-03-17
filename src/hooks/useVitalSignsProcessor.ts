
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
  console.log("DEBUG: useVitalSignsProcessor - Hook initialization start");
  
  // Get state management
  const { lastValidResults, setLastValidResults } = useVitalSignsState();
  console.log("DEBUG: useVitalSignsProcessor - useVitalSignsState initialized", { hasLastResults: !!lastValidResults });
  
  // References for internal state
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const arrhythmiaProcessorRef = useRef<ArrhythmiaProcessor | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const lastArrhythmiaTimeRef = useRef<number>(0);
  
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
  
  /**
   * Process PPG signal directly without simulation or reference values
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult => {
    if (!processorRef.current || !arrhythmiaProcessorRef.current) {
      console.error("DEBUG: useVitalSignsProcessor - Processor not initialized in processSignal call");
      return SignalAnalyzer.createEmptyResult();
    }
    
    // Check signal quality
    const qualityCheck = signalQualityMonitor.checkSignalQuality(value);
    if (qualityCheck.isWeakSignal) {
      return qualityCheck.result;
    }
    
    // Process vital signs
    let result: VitalSignsResult;
    try {
      result = processorRef.current.processSignal(value, rrData);
      // Only log every 100th signal to avoid console flooding
      if (Math.random() < 0.01) {
        console.log("DEBUG: useVitalSignsProcessor - Signal processed", {
          value: value.toFixed(2),
          hasRRData: !!rrData,
          result: {
            spo2: result.spo2,
            pressure: result.pressure,
            arrhythmiaStatus: result.arrhythmiaStatus
          }
        });
      }
    } catch (error) {
      console.error("DEBUG: useVitalSignsProcessor - Error processing signal:", error);
      return SignalAnalyzer.createEmptyResult();
    }
    
    // Process arrhythmias if there is enough data and signal is good
    if (rrData && rrData.intervals.length >= 4 && signalQualityMonitor.weakSignalCount() === 0) {
      try {
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
          
          console.log("DEBUG: useVitalSignsProcessor - New arrhythmia detected", {
            timestamp,
            avgInterval,
            windowWidth,
            arrhythmiaCount: arrhythmiaProcessorRef.current.getArrhythmiaCounter()
          });
        }
      } catch (error) {
        console.error("DEBUG: useVitalSignsProcessor - Error processing arrhythmia:", error);
      }
    }
    
    // Log the signal and result
    signalLogger.logSignal(value, result);
    
    // Store the last valid result
    setLastValidResults(result);
    
    return result;
  }, [addArrhythmiaWindow, signalLogger, signalQualityMonitor, setLastValidResults]);

  const reset = useCallback((): void => {
    console.log("DEBUG: useVitalSignsProcessor - Reset initiated");
    
    if (!processorRef.current || !arrhythmiaProcessorRef.current) {
      console.error("DEBUG: useVitalSignsProcessor - Cannot reset, processors not initialized");
      return;
    }
    
    try {
      processorRef.current.reset();
      arrhythmiaProcessorRef.current.reset();
      resetArrhythmiaWindows();
      setLastValidResults(null);
      lastArrhythmiaTimeRef.current = 0;
      signalQualityMonitor.reset();
      
      console.log("DEBUG: useVitalSignsProcessor - Reset completed successfully");
    } catch (error) {
      console.error("DEBUG: useVitalSignsProcessor - Error during reset:", error);
    }
  }, [resetArrhythmiaWindows, signalQualityMonitor, setLastValidResults]);
  
  const fullReset = useCallback((): void => {
    console.log("DEBUG: useVitalSignsProcessor - Full reset initiated");
    
    if (!processorRef.current || !arrhythmiaProcessorRef.current) {
      console.error("DEBUG: useVitalSignsProcessor - Cannot full reset, processors not initialized");
      return;
    }
    
    try {
      processorRef.current.fullReset();
      arrhythmiaProcessorRef.current.reset();
      setLastValidResults(null);
      resetArrhythmiaWindows();
      signalLogger.reset();
      lastArrhythmiaTimeRef.current = 0;
      signalQualityMonitor.reset();
      
      console.log("DEBUG: useVitalSignsProcessor - Full reset completed successfully");
    } catch (error) {
      console.error("DEBUG: useVitalSignsProcessor - Error during full reset:", error);
    }
  }, [resetArrhythmiaWindows, signalLogger, signalQualityMonitor, setLastValidResults]);

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
