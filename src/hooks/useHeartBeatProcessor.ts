
import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { toast } from 'sonner';
import { useArrhythmiaDetector } from './heart-beat/arrhythmia-detector';
import { useSignalProcessor } from './heart-beat/signal-processor';
import { HeartBeatResult, UseHeartBeatReturn } from './heart-beat/types';
import AudioFeedbackService from '@/services/AudioFeedbackService';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  const missedBeepsCounter = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);
  const lastProcessedPeakTimeRef = useRef<number>(0);
  
  // Hooks para procesamiento y detección
  const {
    detectArrhythmia,
    lastRRIntervalsRef,
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
        console.log('HeartBeatProcessor: New instance created');
        initializedRef.current = true;
        
        if (typeof window !== 'undefined') {
          (window as any).heartBeatProcessor = processorRef.current;
        }
      }
      
      if (processorRef.current) {
        processorRef.current.setMonitoring(true);
        console.log('HeartBeatProcessor: Monitoring state set to true');
        isMonitoringRef.current = true;
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
        processorRef.current.setMonitoring(false);
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  // Simplified requestBeep that uses our centralized service
  const requestBeep = useCallback((value: number): boolean => {
    if (!isMonitoringRef.current) {
      return false;
    }
    
    const signalQuality = lastSignalQualityRef.current;
    const weakSignals = consecutiveWeakSignalsRef.current;
    
    // Only play beep if signal quality is good enough
    if (signalQuality > 0.3 || weakSignals < MAX_CONSECUTIVE_WEAK_SIGNALS) {
      return AudioFeedbackService.playBeep('normal', Math.min(0.8, value + 0.2));
    }
    
    return false;
  }, [MAX_CONSECUTIVE_WEAK_SIGNALS]);

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

    if (result.bpm > 0 && result.confidence > 0.4) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    if (lastRRIntervalsRef.current.length >= 3) {
      const arrhythmiaResult = detectArrhythmia(lastRRIntervalsRef.current);
      
      // Result from ArrhythmiaDetectionService is now used
      result.isArrhythmia = arrhythmiaResult.isArrhythmia;
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
      processorRef.current.setMonitoring(false);
      isMonitoringRef.current = false;
      
      processorRef.current.reset();
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    
    resetArrhythmiaDetector();
    resetSignalProcessor();
    
    missedBeepsCounter.current = 0;
    lastProcessedPeakTimeRef.current = 0;
    
    // Reset ArrhythmiaDetectionService
    ArrhythmiaDetectionService.reset();
  }, [resetArrhythmiaDetector, resetSignalProcessor]);

  const startMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Starting monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = true;
      processorRef.current.setMonitoring(true);
      console.log('HeartBeatProcessor: Monitoring state set to true');
      
      lastPeakTimeRef.current = null;
      lastProcessedPeakTimeRef.current = 0;
      consecutiveWeakSignalsRef.current = 0;
    }
  }, []);

  const stopMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Stopping monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = false;
      processorRef.current.setMonitoring(false);
      console.log('HeartBeatProcessor: Monitoring state set to false');
    }
    
    setCurrentBPM(0);
    setConfidence(0);
  }, []);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia: ArrhythmiaDetectionService.isArrhythmia(),
    requestBeep,
    startMonitoring,
    stopMonitoring
  };
};
