
// Fix the Promise handling for VitalSignsResult
import { useState, useRef, useCallback } from 'react';
import { VitalSignsProcessor } from '../../modules/vital-signs/VitalSignsProcessor';
import { VitalSignsResult, RRData } from '../../types/vital-signs';
import { SignalBuffer } from '../../utils/CircularBuffer';

export const useSignalProcessing = () => {
  const [lastResult, setLastResult] = useState<VitalSignsResult | null>(null);
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const signalBufferRef = useRef<SignalBuffer<number>>(new SignalBuffer<number>(300));
  const arrhythmiaCounter = useRef<number>(0);
  const processedSignals = useRef<number>(0);
  const debugData = useRef<Record<string, any>>({});

  const initializeProcessor = useCallback(() => {
    if (!processorRef.current) {
      console.log("Creating new VitalSignsProcessor instance");
      processorRef.current = new VitalSignsProcessor();
    }
  }, []);

  const reset = useCallback(() => {
    console.log("Resetting signal processor");
    
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    signalBufferRef.current.clear();
    debugData.current = {};
    
    return lastResult;
  }, [lastResult]);

  const fullReset = useCallback(() => {
    console.log("Full reset of signal processor");
    
    if (processorRef.current) {
      processorRef.current.reset(); // Use reset since fullReset might not exist
    }
    
    signalBufferRef.current.clear();
    arrhythmiaCounter.current = 0;
    processedSignals.current = 0;
    debugData.current = {};
    setLastResult(null);
  }, []);

  const processSignal = useCallback((value: number, rrData?: RRData, isWeakSignal?: boolean): VitalSignsResult => {
    processedSignals.current++;
    
    if (isWeakSignal) {
      // Return empty result for weak signals
      const emptyResult: VitalSignsResult = {
        spo2: 0,
        pressure: "--/--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hydration: 0,
        arrhythmia: null,
        confidence: 0,
        timestamp: Date.now()
      };
      return emptyResult;
    }
    
    // Add to buffer
    signalBufferRef.current.push(value);
    
    if (!processorRef.current) {
      initializeProcessor();
    }
    
    try {
      // Process the signal
      const result = processorRef.current!.processSignal(value, rrData);
      
      // Set as last result
      setLastResult(result);
      
      return result;
    } catch (error) {
      console.error("Error processing signal:", error);
      
      // Return safe fallback
      const fallbackResult: VitalSignsResult = {
        spo2: 0,
        pressure: "--/--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hydration: 0,
        arrhythmia: null,
        confidence: 0,
        timestamp: Date.now()
      };
      
      return fallbackResult;
    }
  }, [initializeProcessor]);

  const getArrhythmiaCounter = useCallback(() => {
    if (processorRef.current) {
      return processorRef.current.getArrhythmiaCount ? 
        processorRef.current.getArrhythmiaCount() : 
        arrhythmiaCounter.current;
    }
    return arrhythmiaCounter.current;
  }, []);

  const getDebugInfo = useCallback(() => {
    return {
      ...debugData.current,
      processedSignals: processedSignals.current,
      bufferSize: signalBufferRef.current.size(),
      arrhythmiaCount: getArrhythmiaCounter()
    };
  }, [getArrhythmiaCounter]);

  return {
    processSignal,
    reset,
    fullReset,
    initializeProcessor,
    getArrhythmiaCounter,
    getDebugInfo,
    processedSignals
  };
};
