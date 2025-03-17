
import { useRef, useEffect, useCallback } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';
import { SignalProcessor } from '../modules/vital-signs/signal-processor';

export const useVitalSignsProcessor = (sharedSignalProcessor?: SignalProcessor) => {
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const lastResultRef = useRef<VitalSignsResult | null>(null);
  
  useEffect(() => {
    // Initialize with the shared signal processor if provided
    if (!processorRef.current) {
      processorRef.current = new VitalSignsProcessor(sharedSignalProcessor);
      
      // For global access (mainly for debugging)
      if (typeof window !== 'undefined') {
        (window as any).vitalSignsProcessor = processorRef.current;
      }
    } else if (sharedSignalProcessor && processorRef.current) {
      // Update the processor with the shared signal processor if it changes
      processorRef.current.setSignalProcessor(sharedSignalProcessor);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).vitalSignsProcessor = undefined;
      }
    };
  }, [sharedSignalProcessor]);
  
  const processSignal = useCallback((ppgValue: number, rrData?: { intervals: number[]; lastPeakTime: number | null }): VitalSignsResult | null => {
    if (!processorRef.current) return null;
    
    try {
      const result = processorRef.current.processSignal(ppgValue, rrData);
      lastResultRef.current = result;
      return result;
    } catch (err) {
      console.error('Error processing vital signs:', err);
      return null;
    }
  }, []);
  
  const reset = useCallback((): VitalSignsResult | null => {
    if (!processorRef.current) return null;
    
    const lastResult = lastResultRef.current;
    processorRef.current.reset();
    lastResultRef.current = null;
    
    // Return the last result for potential display
    return lastResult;
  }, []);
  
  const fullReset = useCallback((): void => {
    if (!processorRef.current) return;
    
    processorRef.current.fullReset();
    lastResultRef.current = null;
  }, []);
  
  return {
    processSignal,
    reset,
    fullReset,
    lastValidResults: lastResultRef.current
  };
};
