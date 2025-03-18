
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { HeartBeatResult } from './heart-beat/types';
import { useSignalQualityDetector } from './vital-signs/use-signal-quality-detector';
import { checkWeakSignal } from './heart-beat/signal-processing';
import { HeartBeatConfig } from '../modules/heart-beat/config';

/**
 * Hook to process heart beat signals with no simulation
 */
export const useHeartBeatProcessor = () => {
  const [heartBeatProcessor, setHeartBeatProcessor] = useState<HeartBeatProcessor | null>(null);
  const [bpm, setBpm] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [arrhythmiaCount, setArrhythmiaCount] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [rrIntervals, setRrIntervals] = useState<number[]>([]);
  const [peaks, setPeaks] = useState<{timestamp: number, value: number}[]>([]);
  
  // References to track state between renders
  const lastProcessedValueRef = useRef<number>(0);
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastValidBpmRef = useRef<number>(0);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  
  // Signal quality detection
  const { detectWeakSignal, reset: resetSignalQuality } = useSignalQualityDetector();

  // Use direct quality detection
  const weakSignalsCountRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD;
  const MAX_WEAK_SIGNALS = HeartBeatConfig.LOW_SIGNAL_FRAMES;
  
  /**
   * Initialize processor on mount
   */
  useEffect(() => {
    console.log("useHeartBeatProcessor: Initializing new processor", {
      sessionId: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString()
    });
    
    const processor = new HeartBeatProcessor();
    setHeartBeatProcessor(processor);
    
    // Cleanup on unmount
    return () => {
      console.log("useHeartBeatProcessor: Cleaning up processor", {
        sessionId: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString()
      });
      
      if (processor) {
        processor.setMonitoring(false);
      }
    };
  }, []);
  
  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    if (!heartBeatProcessor) return;
    
    heartBeatProcessor.reset();
    setBpm(0);
    setConfidence(0);
    setArrhythmiaCount(0);
    setRrIntervals([]);
    setPeaks([]);
    lastProcessedValueRef.current = 0;
    lastPeakTimeRef.current = null;
    lastValidBpmRef.current = 0;
    currentBeatIsArrhythmiaRef.current = false;
    resetSignalQuality();
    weakSignalsCountRef.current = 0;
  }, [heartBeatProcessor, resetSignalQuality]);
  
  /**
   * Process signal data directly, no simulation
   */
  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!heartBeatProcessor) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }
    
    // Check for weak signal
    const { isWeakSignal, updatedWeakSignalsCount } = checkWeakSignal(
      value, 
      weakSignalsCountRef.current,
      {
        lowSignalThreshold: WEAK_SIGNAL_THRESHOLD,
        maxWeakSignalCount: MAX_WEAK_SIGNALS
      }
    );
    
    weakSignalsCountRef.current = updatedWeakSignalsCount;
    
    if (isWeakSignal) {
      return {
        bpm: lastValidBpmRef.current,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: heartBeatProcessor.getArrhythmiaCounter() || 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
    }
    
    // Process the signal through the processor
    const result = heartBeatProcessor.processSignal(value);
    
    // Get RR intervals from processor
    const rrData = heartBeatProcessor.getRRIntervals();
    
    // Update state with processed results
    if (result) {
      setBpm(result.bpm);
      setConfidence(result.confidence);
      setArrhythmiaCount(result.arrhythmiaCount);
      
      if (rrData && rrData.intervals) {
        setRrIntervals(rrData.intervals);
      }
      
      if (result.isPeak) {
        const now = Date.now();
        lastPeakTimeRef.current = now;
        
        setPeaks(prev => [
          ...prev.filter(p => now - p.timestamp < 5000),
          { timestamp: now, value }
        ]);
      }
      
      // Track last valid BPM
      if (result.bpm >= 40 && result.bpm <= 200 && result.confidence > 0.5) {
        lastValidBpmRef.current = result.bpm;
      }
      
      // Get arrhythmia status
      let isArrhythmiaResult = false;
      // Only call isArrhythmia if it exists on the processor
      if (typeof heartBeatProcessor.isArrhythmia === 'function') {
        isArrhythmiaResult = heartBeatProcessor.isArrhythmia();
      }
      currentBeatIsArrhythmiaRef.current = isArrhythmiaResult;
      
      lastProcessedValueRef.current = value;
      
      // Return a complete HeartBeatResult
      return {
        bpm: result.bpm,
        confidence: result.confidence,
        isPeak: result.isPeak,
        arrhythmiaCount: result.arrhythmiaCount,
        isArrhythmia: isArrhythmiaResult,
        rrData: rrData
      };
    }
    
    return {
      bpm: lastValidBpmRef.current,
      confidence: 0,
      isPeak: false,
      arrhythmiaCount: heartBeatProcessor.getArrhythmiaCounter() || 0,
      rrData: {
        intervals: [],
        lastPeakTime: null
      }
    };
  }, [heartBeatProcessor]);

  // Add the missing methods to match what's expected in Index.tsx
  const startMonitoring = useCallback(() => {
    if (heartBeatProcessor) {
      heartBeatProcessor.setMonitoring(true);
      setIsMonitoring(true);
    }
  }, [heartBeatProcessor]);

  const stopMonitoring = useCallback(() => {
    if (heartBeatProcessor) {
      heartBeatProcessor.setMonitoring(false);
      setIsMonitoring(false);
    }
  }, [heartBeatProcessor]);

  // Create a proper isArrhythmia function that safely checks the processor
  const isArrhythmia = useCallback(() => {
    if (!heartBeatProcessor) return false;
    
    // Check if the method exists before calling it
    if (typeof heartBeatProcessor.isArrhythmia === 'function') {
      return heartBeatProcessor.isArrhythmia();
    }
    
    // Fallback to the stored ref value if method doesn't exist
    return currentBeatIsArrhythmiaRef.current;
  }, [heartBeatProcessor]);

  return {
    heartBeatProcessor,
    processSignal,
    reset,
    bpm,
    confidence,
    arrhythmiaCount,
    rrIntervals,
    peaks,
    isMonitoring,
    lastPeakTimeRef,
    currentBeatIsArrhythmiaRef,
    isArrhythmia,
    startMonitoring,
    stopMonitoring,
  };
};
