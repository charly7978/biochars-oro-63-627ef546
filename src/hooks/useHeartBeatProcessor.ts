
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { toast } from 'sonner';
import { RRAnalysisResult } from './arrhythmia/types';
import { useBeepProcessor } from './heart-beat/beep-processor';
import { useArrhythmiaDetector } from './heart-beat/arrhythmia-detector';
import { useSignalProcessor } from './heart-beat/signal-processor';
import { HeartBeatResult, UseHeartBeatReturn } from './heart-beat/types';

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  const missedBeepsCounter = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);
  
  // Import refactored modules
  const { 
    requestImmediateBeep, 
    processBeepQueue, 
    pendingBeepsQueue, 
    lastBeepTimeRef, 
    beepProcessorTimeoutRef, 
    cleanup: cleanupBeepProcessor 
  } = useBeepProcessor();
  
  const {
    detectArrhythmia,
    heartRateVariabilityRef,
    stabilityCounterRef,
    lastRRIntervalsRef,
    lastIsArrhythmiaRef,
    currentBeatIsArrhythmiaRef,
    reset: resetArrhythmiaDetector
  } = useArrhythmiaDetector();
  
  const {
    processSignal: processSignalInternal,
    reset: resetSignalProcessor,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS
  } = useSignalProcessor();

  useEffect(() => {
    console.log('useHeartBeatProcessor: Initializing new processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    try {
      if (!processorRef.current) {
        processorRef.current = new HeartBeatProcessor();
        console.log('HeartBeatProcessor: New instance created - direct measurement mode only');
        initializedRef.current = true;
        
        if (typeof window !== 'undefined') {
          (window as any).heartBeatProcessor = processorRef.current;
        }
      }
      
      if (processorRef.current) {
        processorRef.current.initAudio();
        // Ensure monitoring is off by default
        processorRef.current.setMonitoring(false);
        console.log('HeartBeatProcessor: Monitoring state set to false');
        isMonitoringRef.current = false;
      }
    } catch (error) {
      console.error('Error initializing HeartBeatProcessor:', error);
      toast.error('Error initializing heartbeat processor');
    }

    return () => {
      console.log('useHeartBeatProcessor: Cleaning up processor', {
        sessionId: sessionId.current,
        timestamp: new Date().toISOString()
      });
      
      if (processorRef.current) {
        // Ensure monitoring is turned off when unmounting
        processorRef.current.setMonitoring(false);
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  // Helper to request beep with all the necessary refs
  const requestBeep = useCallback((value: number): boolean => {
    if (!processorRef.current) return false;
    
    return requestImmediateBeep(
      value, 
      isMonitoringRef, 
      lastSignalQualityRef, 
      consecutiveWeakSignalsRef, 
      MAX_CONSECUTIVE_WEAK_SIGNALS, 
      missedBeepsCounter, 
      processorRef.current.playBeep.bind(processorRef.current)
    );
  }, [requestImmediateBeep]);

  // Main signal processing function that uses the refactored modules
  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
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

    const result = processSignalInternal(
      value, 
      currentBPM, 
      confidence, 
      processorRef.current, 
      requestBeep, 
      isMonitoringRef, 
      lastRRIntervalsRef, 
      currentBeatIsArrhythmiaRef
    );

    // Only update BPM and confidence if the values are reasonable
    if (result.bpm > 0 && result.confidence > 0.4) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    // Analyze RR intervals for arrhythmia detection using only real data
    if (lastRRIntervalsRef.current.length >= 3) {
      const arrhythmiaResult = detectArrhythmia(lastRRIntervalsRef.current);
      currentBeatIsArrhythmiaRef.current = arrhythmiaResult.isArrhythmia;
      
      // Update result with arrhythmia status
      result.isArrhythmia = currentBeatIsArrhythmiaRef.current;
    }

    return result;
  }, [
    currentBPM, 
    confidence, 
    processSignalInternal, 
    requestBeep, 
    detectArrhythmia
  ]);

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Resetting processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      // Turn off monitoring first
      processorRef.current.setMonitoring(false);
      isMonitoringRef.current = false;
      
      // Then reset the processor
      processorRef.current.reset();
      processorRef.current.initAudio();
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    
    // Reset all submodules
    resetArrhythmiaDetector();
    resetSignalProcessor();
    
    missedBeepsCounter.current = 0;
    
    // Clear any pending beeps
    cleanupBeepProcessor();
  }, [resetArrhythmiaDetector, resetSignalProcessor, cleanupBeepProcessor]);

  // Function to start monitoring
  const startMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Starting monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = true;
      processorRef.current.setMonitoring(true);
      console.log('HeartBeatProcessor: Monitoring state set to true');
      
      // Reset state counters
      lastPeakTimeRef.current = null;
      lastBeepTimeRef.current = 0;
      pendingBeepsQueue.current = [];
      consecutiveWeakSignalsRef.current = 0;
      
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
        beepProcessorTimeoutRef.current = null;
      }
    }
  }, []);

  // Function to stop monitoring
  const stopMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Stopping monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = false;
      processorRef.current.setMonitoring(false);
      console.log('HeartBeatProcessor: Monitoring state set to false');
    }
    
    // Clear any pending beeps
    cleanupBeepProcessor();
    
    // Reset BPM values
    setCurrentBPM(0);
    setConfidence(0);
  }, [cleanupBeepProcessor]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: currentBeatIsArrhythmiaRef.current,
    requestBeep,
    startMonitoring,
    stopMonitoring
  };
};
