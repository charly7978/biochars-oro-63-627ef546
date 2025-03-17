
import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';

/**
 * Hook for basic processing of vital signs
 */
export const useVitalSignsProcessor = () => {
  // State management
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // References for internal state
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignals = useRef<number>(0);
  
  // Initialize processor
  useEffect(() => {
    console.log("useVitalSignsProcessor: Initializing processor", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Create new instance
    processorRef.current = new VitalSignsProcessor();
    
    return () => {
      console.log("useVitalSignsProcessor: Processor cleanup", {
        sessionId: sessionId.current,
        processedSignals: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, []);
  
  /**
   * Process PPG signal
   */
  const processSignal = useCallback((value: number) => {
    if (!processorRef.current) {
      console.log("useVitalSignsProcessor: Processor not initialized");
      return {
        spo2: 0,
        pressure: "--/--"
      };
    }
    
    processedSignals.current++;
    
    // Log less frequently
    if (processedSignals.current % 45 === 0) {
      console.log("useVitalSignsProcessor: Processing signal", {
        inputValue: value,
        signalNumber: processedSignals.current,
        sessionId: sessionId.current
      });
    }
    
    // Process signal through processor
    let result = processorRef.current.processSignal(value);
    
    // Log processed signals occasionally
    if (processedSignals.current % 100 === 0) {
      console.log("useVitalSignsProcessor: Processing status", {
        processed: processedSignals.current,
        pressure: result.pressure,
        spo2: result.spo2
      });
    }
    
    return result;
  }, []);

  /**
   * Perform complete reset
   */
  const reset = useCallback(() => {
    if (!processorRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset initiated");
    
    processorRef.current.reset();
    setLastValidResults(null);
    
    console.log("useVitalSignsProcessor: Reset completed");
    return null;
  }, []);
  
  /**
   * Perform full reset
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current) return;
    
    console.log("useVitalSignsProcessor: Full reset initiated");
    
    processorRef.current.fullReset();
    setLastValidResults(null);
    processedSignals.current = 0;
    
    console.log("useVitalSignsProcessor: Full reset complete");
  }, []);

  return {
    processSignal,
    reset,
    fullReset,
    lastValidResults: null,
    debugInfo: {
      processedSignals: processedSignals.current
    }
  };
};
