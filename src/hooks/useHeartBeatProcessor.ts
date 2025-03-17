
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
        try {
          processorRef.current.stopMonitoring();
        } catch (err) {
          console.error("Error during cleanup:", err);
        }
      }
    };
  }, []);
  
  const startMonitoring = useCallback(() => {
    console.log("useHeartBeatProcessor: Starting monitoring");
    if (processorRef.current) {
      try {
        processorRef.current.startMonitoring();
        setIsMonitoring(true);
      } catch (err) {
        console.error("Error starting monitoring:", err);
      }
    }
  }, []);
  
  const stopMonitoring = useCallback(() => {
    console.log("useHeartBeatProcessor: Stopping monitoring");
    if (processorRef.current) {
      try {
        processorRef.current.stopMonitoring();
        setIsMonitoring(false);
      } catch (err) {
        console.error("Error stopping monitoring:", err);
      }
    }
  }, []);
  
  const reset = useCallback(() => {
    console.log("useHeartBeatProcessor: Resetting");
    if (processorRef.current) {
      try {
        processorRef.current.reset();
        setIsArrhythmia(false);
      } catch (err) {
        console.error("Error resetting processor:", err);
      }
    }
  }, []);
  
  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      console.warn("useHeartBeatProcessor: Processor not initialized");
      return { bpm: 0, confidence: 0 };
    }
    
    try {
      const result = processorRef.current.processValue(value);
      setIsArrhythmia(processorRef.current.isArrhythmiaDetected());
      return result;
    } catch (err) {
      console.error("Error processing signal:", err);
      return { bpm: 0, confidence: 0 };
    }
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
