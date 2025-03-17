
import { useState, useEffect, useRef } from 'react';
import { RRData } from './arrhythmia/types';

export const useHeartBeatProcessor = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const processorRef = useRef<any>(null);
  const heartRateHistoryRef = useRef<number[]>([]);
  const arrhythmiaDetectedRef = useRef(false);
  const isMonitoringRef = useRef(false);
  
  useEffect(() => {
    // Check if the processor is available in the window
    if (window && (window as any).heartBeatProcessor) {
      processorRef.current = (window as any).heartBeatProcessor;
      setIsInitialized(true);
    }
  }, []);

  const playBeep = (volume = 1.0) => {
    if (processorRef.current) {
      try {
        processorRef.current.playBeep(volume);
        return true;
      } catch (err) {
        console.error("Error playing beep:", err);
        return false;
      }
    }
    return false;
  };

  const processSignal = (value: number, isFingerDetected: boolean) => {
    if (!processorRef.current || !isMonitoringRef.current || !isFingerDetected) {
      return { bpm: 0, confidence: 0, rrData: { intervals: [], lastPeakTime: null } };
    }

    try {
      // Process the signal through the processor
      const result = processorRef.current.processSignal(value);
      
      // Add BPM to history for analysis
      if (result.bpm > 0) {
        heartRateHistoryRef.current.push(result.bpm);
        // Keep history at a reasonable size
        if (heartRateHistoryRef.current.length > 20) {
          heartRateHistoryRef.current.shift();
        }
      }
      
      // Get RR intervals from the processor if available
      const rrData: RRData = processorRef.current.getRRIntervals 
        ? processorRef.current.getRRIntervals() 
        : { intervals: [], lastPeakTime: null };
      
      // Return the processed result with RR intervals
      return {
        ...result,
        rrData
      };
    } catch (err) {
      console.error("Error processing signal:", err);
      return { 
        bpm: 0, 
        confidence: 0, 
        rrData: { intervals: [], lastPeakTime: null } 
      };
    }
  };

  const startMonitoring = () => {
    console.log("Heart Beat Processor: Starting monitoring");
    if (processorRef.current && processorRef.current.reset) {
      processorRef.current.reset();
    }
    heartRateHistoryRef.current = [];
    setIsArrhythmia(false);
    arrhythmiaDetectedRef.current = false;
    isMonitoringRef.current = true;
  };

  const stopMonitoring = () => {
    console.log("Heart Beat Processor: Stopping monitoring");
    // Clean up any ongoing processing
    heartRateHistoryRef.current = [];
    setIsArrhythmia(false);
    arrhythmiaDetectedRef.current = false;
    isMonitoringRef.current = false;
  };

  const reset = () => {
    console.log("Heart Beat Processor: Reset");
    if (processorRef.current && processorRef.current.reset) {
      processorRef.current.reset();
    }
    heartRateHistoryRef.current = [];
    setIsArrhythmia(false);
    arrhythmiaDetectedRef.current = false;
    isMonitoringRef.current = false;
  };

  return {
    isInitialized,
    playBeep,
    processor: processorRef.current,
    processSignal,
    isArrhythmia,
    startMonitoring,
    stopMonitoring,
    reset,
    isMonitoring: isMonitoringRef.current
  };
};
