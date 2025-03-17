
import { useState, useRef, useCallback, useEffect } from 'react';

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
}

export const useHeartBeatProcessor = () => {
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const calibrationProgressRef = useRef<number>(0);
  const calibrationCompleteRef = useRef<boolean>(false);
  const processorRef = useRef<any>(null);
  
  // Initialize heart beat processor
  useEffect(() => {
    processorRef.current = (window as any).heartBeatProcessor;
    
    if (!processorRef.current) {
      console.error("HeartBeatProcessor not available in window object");
    } else {
      console.log("HeartBeatProcessor initialized");
    }
    
    return () => {
      // Cleanup
    };
  }, []);
  
  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (processorRef.current && processorRef.current.startProcessing) {
      processorRef.current.startProcessing();
      console.log("Heart beat monitoring started");
    }
  }, []);
  
  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (processorRef.current && processorRef.current.stopProcessing) {
      processorRef.current.stopProcessing();
      console.log("Heart beat monitoring stopped");
    }
  }, []);
  
  // Process signal
  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      return { bpm: 0, confidence: 0 };
    }
    
    try {
      // Process the signal with the processor
      const result = processorRef.current.processSignal(value);
      
      // Check for arrhythmia
      const arrhythmiaState = processorRef.current.isArrhythmia ? processorRef.current.isArrhythmia() : false;
      setIsArrhythmia(arrhythmiaState);
      
      // Update calibration progress
      if (processorRef.current.getCalibrationProgress) {
        calibrationProgressRef.current = processorRef.current.getCalibrationProgress();
      }
      
      if (processorRef.current.isCalibrationComplete) {
        calibrationCompleteRef.current = processorRef.current.isCalibrationComplete();
      }
      
      // Return the result with RR intervals if available
      return {
        bpm: Math.round(result.bpm || 0),
        confidence: result.confidence || 0,
        rrData: result.rrData
      };
    } catch (error) {
      console.error("Error processing signal:", error);
      return { bpm: 0, confidence: 0 };
    }
  }, []);
  
  // Reset processor
  const reset = useCallback(() => {
    if (processorRef.current && processorRef.current.reset) {
      processorRef.current.reset();
      console.log("Heart beat processor reset");
      setIsArrhythmia(false);
      calibrationProgressRef.current = 0;
      calibrationCompleteRef.current = false;
    }
  }, []);
  
  // Request beep for heartbeat
  const requestBeep = useCallback((value: number): boolean => {
    if (processorRef.current && processorRef.current.playBeep) {
      processorRef.current.playBeep(value);
      return true;
    }
    return false;
  }, []);
  
  // Get calibration progress
  const getCalibrationProgress = useCallback((): number => {
    return calibrationProgressRef.current;
  }, []);
  
  // Check if calibration is complete
  const isCalibrationComplete = useCallback((): boolean => {
    return calibrationCompleteRef.current;
  }, []);
  
  return {
    processSignal,
    reset,
    isArrhythmia,
    requestBeep,
    startMonitoring,
    stopMonitoring,
    getCalibrationProgress,
    isCalibrationComplete
  };
};
