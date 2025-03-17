
import { useState, useEffect, useRef, useCallback } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';

export type HeartBeatResult = {
  bpm: number;
  confidence: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
};

export function useHeartBeatProcessor() {
  // Use local HeartBeatProcessor instance instead of window.HeartBeatProcessor
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  useEffect(() => {
    try {
      console.log("useHeartBeatProcessor: Initializing new processor", {
        sessionId: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString()
      });
      
      // Create a new instance of our local HeartBeatProcessor
      processorRef.current = new HeartBeatProcessor();
    } catch (error) {
      console.error("Error initializing HeartBeatProcessor:", error);
    }
    
    return () => {
      console.log("useHeartBeatProcessor: Cleanup");
      if (processorRef.current) {
        // Check if stopMonitoring exists before calling it
        if (typeof processorRef.current.stopMonitoring === 'function') {
          processorRef.current.stopMonitoring();
        }
      }
    };
  }, []);
  
  const startMonitoring = useCallback(() => {
    console.log("useHeartBeatProcessor: Starting monitoring");
    if (processorRef.current) {
      // Check if startMonitoring exists before calling it
      if (typeof processorRef.current.startMonitoring === 'function') {
        processorRef.current.startMonitoring();
      }
      setIsMonitoring(true);
    }
  }, []);
  
  const stopMonitoring = useCallback(() => {
    console.log("useHeartBeatProcessor: Stopping monitoring");
    if (processorRef.current) {
      // Check if stopMonitoring exists before calling it
      if (typeof processorRef.current.stopMonitoring === 'function') {
        processorRef.current.stopMonitoring();
      }
      setIsMonitoring(false);
    }
  }, []);
  
  const reset = useCallback(() => {
    console.log("useHeartBeatProcessor: Resetting");
    if (processorRef.current) {
      // Check if reset exists before calling it
      if (typeof processorRef.current.reset === 'function') {
        processorRef.current.reset();
      }
      setIsArrhythmia(false);
    }
  }, []);
  
  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      console.warn("useHeartBeatProcessor: Processor not initialized");
      return { bpm: 0, confidence: 0 };
    }
    
    const result = processorRef.current.processValue(value);
    setIsArrhythmia(processorRef.current.isArrhythmiaDetected());
    
    return result;
  }, []);
  
  return {
    processSignal,
    isArrhythmia,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    reset
  };
}
