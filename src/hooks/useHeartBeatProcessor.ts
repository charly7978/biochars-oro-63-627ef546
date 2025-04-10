import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { toast } from 'sonner';
import { useBeepProcessor } from './heart-beat/beep-processor';
import { useSignalProcessor } from './heart-beat/signal-processor';
import { HeartBeatResult, UseHeartBeatReturn } from './heart-beat/types';
import { ArrhythmiaDetectionService } from '../services/ArrhythmiaDetectionService';

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  const missedBeepsCounter = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);
  const lastProcessedPeakTimeRef = useRef<number>(0);
  
  // Replace arrhythmia detector with new service
  const arrhythmiaServiceRef = useRef<ArrhythmiaDetectionService | null>(null);
  const lastRRIntervalsRef = useRef<number[]>([]);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  
  // Initialize arrhythmia service if needed
  if (!arrhythmiaServiceRef.current) {
    arrhythmiaServiceRef.current = new ArrhythmiaDetectionService();
  }
  
  // Hooks para procesamiento y detección, sin funcionalidad de beep
  const { 
    requestImmediateBeep, 
    processBeepQueue, 
    pendingBeepsQueue, 
    lastBeepTimeRef, 
    beepProcessorTimeoutRef, 
    cleanup: cleanupBeepProcessor 
  } = useBeepProcessor();
  
  const {
    processSignal: processSignalInternal,
    reset: resetSignalProcessor,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS,
    arrhythmiaSegmentsRef
  } = useSignalProcessor();

  useEffect(() => {
    console.log('useHeartBeatProcessor: Initializing new processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    try {
      if (!processorRef.current) {
        processorRef.current = new HeartBeatProcessor();
        console.log('HeartBeatProcessor: New instance created - sin audio activado');
        initializedRef.current = true;
        
        if (typeof window !== 'undefined') {
          (window as any).heartBeatProcessor = processorRef.current;
        }
      }
      
      if (processorRef.current) {
        processorRef.current.setMonitoring(true);
        console.log('HeartBeatProcessor: Monitoring state set to true, audio centralizado en PPGSignalMeter');
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

  const requestBeep = useCallback((value: number): boolean => {
    console.log('useHeartBeatProcessor: Beep ELIMINADO - Todo el sonido SOLO en PPGSignalMeter', {
      value,
      isMonitoring: isMonitoringRef.current,
      processorExists: !!processorRef.current,
      timestamp: new Date().toISOString()
    });
    
    return false;
  }, []);

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

    // Use the ArrhythmiaDetectionService for arrhythmia detection
    if (lastRRIntervalsRef.current.length >= 3 && arrhythmiaServiceRef.current) {
      const arrhythmiaResult = arrhythmiaServiceRef.current.detectArrhythmia({
        intervals: lastRRIntervalsRef.current,
        lastPeakTime: result.rrData.lastPeakTime
      });
      
      currentBeatIsArrhythmiaRef.current = arrhythmiaResult.isArrhythmia;
      result.isArrhythmia = arrhythmiaResult.isArrhythmia;
      result.arrhythmiaCount = arrhythmiaServiceRef.current.getArrhythmiaCount();
    }

    return result;
  }, [
    currentBPM, 
    confidence, 
    processSignalInternal, 
    requestBeep
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
      // No iniciamos audio aquí, está centralizado en PPGSignalMeter
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    
    // Reset arrhythmia detection service
    if (arrhythmiaServiceRef.current) {
      arrhythmiaServiceRef.current.reset();
    }
    lastRRIntervalsRef.current = [];
    currentBeatIsArrhythmiaRef.current = false;
    
    resetSignalProcessor();
    
    missedBeepsCounter.current = 0;
    lastProcessedPeakTimeRef.current = 0;
    
    cleanupBeepProcessor();
  }, [resetSignalProcessor, cleanupBeepProcessor]);

  const startMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Starting monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = true;
      processorRef.current.setMonitoring(true);
      console.log('HeartBeatProcessor: Monitoring state set to true');
      
      lastPeakTimeRef.current = null;
      lastBeepTimeRef.current = 0;
      lastProcessedPeakTimeRef.current = 0;
      pendingBeepsQueue.current = [];
      consecutiveWeakSignalsRef.current = 0;
      
      // No iniciamos audio ni test beep aquí, está centralizado en PPGSignalMeter
      
      if (beepProcessorTimeoutRef.current) {
        clearTimeout(beepProcessorTimeoutRef.current);
        beepProcessorTimeoutRef.current = null;
      }
    }
  }, []);

  const stopMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Stopping monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = false;
      processorRef.current.setMonitoring(false);
      console.log('HeartBeatProcessor: Monitoring state set to false');
    }
    
    cleanupBeepProcessor();
    
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
    stopMonitoring,
    arrhythmiaSegments: arrhythmiaSegmentsRef.current
  };
};
