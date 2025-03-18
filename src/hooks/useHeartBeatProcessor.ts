
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { toast } from 'sonner';
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
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  const lastRRIntervalsRef = useRef<number[]>([]);
  
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
    lastIsArrhythmiaRef,
    reset: resetArrhythmiaDetector
  } = useArrhythmiaDetector();
  
  // Create a custom signal processor just for this hook
  const signalProcessor = useSignalProcessor();
  
  const lastPeakTimeRef = useRef<number | null>(null);
  const lastValidBpmRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 10;

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
    
    return requestImmediateBeep(value);
  }, [requestImmediateBeep]);

  // Main signal processing function
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

    // Simple signal processing directly (not using the complex refactored modules)
    try {
      // Use the processor to analyze the signal
      const processedValue = processorRef.current.filterSignal(value);
      const isPeak = processorRef.current.detectPeak(processedValue);
      
      const now = Date.now();
      
      // Calculate BPM if a peak is detected
      if (isPeak && lastPeakTimeRef.current) {
        const interval = now - lastPeakTimeRef.current;
        
        // Only consider reasonable intervals (30 to 240 BPM)
        if (interval > 250 && interval < 2000) {
          const instantBpm = 60000 / interval;
          
          // Update BPM with moving average
          const newBpm = currentBPM > 0 
            ? 0.7 * currentBPM + 0.3 * instantBpm 
            : instantBpm;
          
          setCurrentBPM(Math.round(newBpm));
          setConfidence(0.8);
          
          // Update RR intervals for arrhythmia detection
          lastRRIntervalsRef.current.push(interval);
          if (lastRRIntervalsRef.current.length > 10) {
            lastRRIntervalsRef.current.shift();
          }
          
          // Detect arrhythmia if we have enough intervals
          if (lastRRIntervalsRef.current.length >= 5) {
            const arrhythmiaResult = detectArrhythmia(lastRRIntervalsRef.current);
            currentBeatIsArrhythmiaRef.current = arrhythmiaResult.isArrhythmia;
          }
          
          // Request a beep for the heart beat
          requestBeep(processedValue);
        }
      }
      
      // Update last peak time
      if (isPeak) {
        lastPeakTimeRef.current = now;
      }
      
      // Ensure BPM is within reasonable range
      const bpm = currentBPM >= 40 && currentBPM <= 200 ? currentBPM : 0;
      
      return {
        bpm,
        confidence: confidence,
        isPeak,
        arrhythmiaCount: 0,
        filteredValue: processedValue,
        isArrhythmia: currentBeatIsArrhythmiaRef.current,
        rrData: {
          intervals: lastRRIntervalsRef.current,
          lastPeakTime: lastPeakTimeRef.current
        }
      };
    } catch (error) {
      console.error('Error processing signal:', error);
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
  }, [currentBPM, confidence, detectArrhythmia, requestBeep]);

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
    
    missedBeepsCounter.current = 0;
    lastPeakTimeRef.current = null;
    lastRRIntervalsRef.current = [];
    currentBeatIsArrhythmiaRef.current = false;
    
    // Clear any pending beeps
    cleanupBeepProcessor();
  }, [resetArrhythmiaDetector, cleanupBeepProcessor]);

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
