
import { useState, useRef, useEffect, useCallback } from 'react';
import { SimpleVitalSignsProcessor, VitalSignsOutput } from '../modules/vital-signs/SimpleVitalSignsProcessor';

export interface UseSimpleVitalSignsReturn {
  processHeartRate: (bpm: number, confidence: number) => VitalSignsOutput;
  reset: () => void;
  fullReset: () => void;
  lastResults: VitalSignsOutput | null;
  isProcessing: boolean;
  startProcessing: () => void;
  stopProcessing: () => void;
}

/**
 * Simplified hook for vital signs processing
 */
export const useSimpleVitalSigns = (): UseSimpleVitalSignsReturn => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastResults, setLastResults] = useState<VitalSignsOutput | null>(null);
  const processorRef = useRef<SimpleVitalSignsProcessor | null>(null);
  const sessionIdRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Initialize processor
  useEffect(() => {
    if (!processorRef.current) {
      console.log("useSimpleVitalSigns: Creating processor instance", {
        sessionId: sessionIdRef.current,
        timestamp: new Date().toISOString()
      });
      processorRef.current = new SimpleVitalSignsProcessor();
    }
    
    return () => {
      console.log("useSimpleVitalSigns: Cleaning up");
      processorRef.current = null;
    };
  }, []);
  
  // Process heart rate data
  const processHeartRate = useCallback((bpm: number, confidence: number): VitalSignsOutput => {
    if (!processorRef.current || !isProcessing) {
      return {
        spo2: 0,
        heartRate: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        arrhythmiaCount: 0,
        confidence: 0
      };
    }
    
    // Process the heart rate data
    const results = processorRef.current.processHeartRate(bpm, confidence);
    
    // Update state with latest results
    setLastResults(results);
    
    // Return the results
    return results;
  }, [isProcessing]);
  
  // Reset function
  const reset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    setLastResults(null);
    console.log("useSimpleVitalSigns: Reset completed");
  }, []);
  
  // Full reset function
  const fullReset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.fullReset();
    }
    
    setLastResults(null);
    console.log("useSimpleVitalSigns: Full reset completed");
  }, []);
  
  // Start processing
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
    console.log("useSimpleVitalSigns: Started processing");
  }, []);
  
  // Stop processing
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    setLastResults(null);
    console.log("useSimpleVitalSigns: Stopped processing");
  }, []);
  
  return {
    processHeartRate,
    reset,
    fullReset,
    lastResults,
    isProcessing,
    startProcessing,
    stopProcessing
  };
};
