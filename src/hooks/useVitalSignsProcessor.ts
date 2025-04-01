
/**
 * Hook for processing vital signs signals
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor } from '../modules/signal-processing/VitalSignsProcessor';
import type { VitalSignsResult, RRIntervalData } from '../types/vital-signs';

export function useVitalSignsProcessor() {
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Initialize processor on mount
  useEffect(() => {
    processorRef.current = new VitalSignsProcessor();
    console.log("VitalSignsProcessor initialized");
    
    // Cleanup on unmount
    return () => {
      if (processorRef.current) {
        console.log("VitalSignsProcessor cleanup");
      }
    };
  }, []);
  
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
    
    const result = processorRef.current.process({
      value,
      rrData
    });
    
    // Store valid results
    if (result.spo2 > 0) {
      setLastValidResults(result);
    }
    
    return result;
  }, []);
  
  // Reset the processor and return last valid results
  const reset = useCallback((): VitalSignsResult | null => {
    return lastValidResults;
  }, [lastValidResults]);
  
  // Completely reset the processor
  const fullReset = useCallback((): void => {
    if (processorRef.current) {
      console.log("Full reset of VitalSignsProcessor");
      setLastValidResults(null);
    }
  }, []);
  
  return {
    processSignal,
    reset,
    fullReset,
    lastValidResults,
    arrhythmiaCounter: processorRef.current?.getArrhythmiaCounter() || 0
  };
}
