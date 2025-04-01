/**
 * Hook for processing vital signs signals
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor } from '../modules/vital-signs'; // Import from central module
import type { VitalSignsResult, RRIntervalData } from '../types/vital-signs';
import type { ArrhythmiaWindow } from './vital-signs/types';

export function useVitalSignsProcessor() {
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  const debugInfo = useRef({
    processedSignals: 0,
    signalLog: [] as { timestamp: number, value: number, result: any }[]
  });
  
  // Initialize processor on mount
  const initializeProcessor = useCallback(() => {
    processorRef.current = new VitalSignsProcessor();
    console.log("VitalSignsProcessor initialized");
  }, []);

  // Initialization effect
  useEffect(() => {
    if (!processorRef.current) {
      initializeProcessor();
    }
    
    // Cleanup on unmount
    return () => {
      if (processorRef.current) {
        console.log("VitalSignsProcessor cleanup");
        processorRef.current = null;
      }
    };
  }, [initializeProcessor]);
  
  // Process signal data
  const processSignal = useCallback((
    value: number, 
    rrData?: RRIntervalData
  ): VitalSignsResult => {
    if (!processorRef.current) {
      console.warn("VitalSignsProcessor not initialized");
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        }
      };
    }
    
    debugInfo.current.processedSignals++;
    
    // Note: Using processSignal instead of process
    const result = processorRef.current.processSignal({
      value,
      rrData
    });
    
    // Log for debugging
    if (debugInfo.current.processedSignals % 30 === 0) {
      debugInfo.current.signalLog.push({
        timestamp: Date.now(),
        value,
        result: { ...result }
      });
      
      // Keep log size manageable
      if (debugInfo.current.signalLog.length > 20) {
        debugInfo.current.signalLog.shift();
      }
    }
    
    // Store valid results
    if (result.spo2 > 0) {
      setLastValidResults(result);
    }
    
    // Check for arrhythmia and update windows
    if (result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED")) {
      const now = Date.now();
      setArrhythmiaWindows(prev => {
        const newWindow = { start: now, end: now + 5000 };
        return [...prev, newWindow];
      });
    }
    
    return result;
  }, []);
  
  // Reset the processor and return last valid results
  const reset = useCallback((): VitalSignsResult | null => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    return lastValidResults;
  }, [lastValidResults]);
  
  // Completely reset the processor
  const fullReset = useCallback((): void => {
    if (processorRef.current) {
      console.log("Full reset of VitalSignsProcessor");
      processorRef.current.fullReset();
      setLastValidResults(null);
      setArrhythmiaWindows([]);
      debugInfo.current = {
        processedSignals: 0,
        signalLog: []
      };
    }
  }, []);
  
  return {
    processSignal,
    reset,
    fullReset,
    initializeProcessor,
    lastValidResults,
    arrhythmiaCounter: processorRef.current?.getArrhythmiaCounter() || 0,
    arrhythmiaWindows,
    debugInfo: debugInfo.current
  };
}
