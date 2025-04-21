import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { toast } from 'sonner';
import { RRAnalysisResult } from './arrhythmia/types';
import { useBeepProcessor } from './heart-beat/beep-processor';
import { useSignalProcessor } from './heart-beat/signal-processor';
import { HeartBeatResult, UseHeartBeatReturn } from './heart-beat/types';
import { useArrhythmiaPatternDetector } from './heart-beat/arrhythmia-pattern-detector';

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [isArrhythmia, setIsArrhythmia] = useState<boolean>(false);
  const [lastPeakTime, setLastPeakTime] = useState<number | null>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  const missedBeepsCounter = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);
  const lastProcessedPeakTimeRef = useRef<number>(0);
  
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
    MAX_CONSECUTIVE_WEAK_SIGNALS
  } = useSignalProcessor();

  // Mantener el último resultado para exponer isArrhythmia y arrhythmiaCount
  const lastResultRef = useRef<HeartBeatResult | null>(null);

  // Referencias locales para cumplir con la firma de processSignalInternal
  const lastRRIntervalsRef = useRef<number[]>([]);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);

  // Nuevo detector de patrón rítmico
  const {
    phase: arrhythmiaPhase,
    baseRR,
    baseSDNN,
    beats,
    registerBeat,
    reset: resetArrhythmia
  } = useArrhythmiaPatternDetector();

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
        processorRef.current.startMonitoring();
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
        processorRef.current.stopMonitoring();
        processorRef.current = null;
      }
      
      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  // Esta función ahora no hace nada, el beep está centralizado en PPGSignalMeter
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
      const emptyResult = {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        isArrhythmia: false,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
      lastResultRef.current = emptyResult;
      return emptyResult;
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

    lastResultRef.current = result;

    // Llamar a registerBeat SOLO cuando se detecta un pico real
    if (result.isPeak) {
      registerBeat();
      setLastPeakTime(Date.now());
    }
    // Detectar arritmia en tiempo real
    if (beats.length > 0) {
      const lastBeat = beats[beats.length - 1];
      setIsArrhythmia(lastBeat.isAnomalous);
    }

    return {
      bpm: currentBPM,
      confidence,
      isPeak: result.isPeak,
      arrhythmiaCount: beats.filter(b => b.isAnomalous).length,
      rrData: {
        intervals: beats.map(b => b.rr),
        lastPeakTime: lastPeakTime
      },
      isArrhythmia: isArrhythmia
    };
  }, [
    currentBPM, 
    confidence, 
    processSignalInternal, 
    requestBeep,
    beats,
    isArrhythmia,
    registerBeat
  ]);

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Resetting processor', {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    if (processorRef.current) {
      processorRef.current.stopMonitoring();
      isMonitoringRef.current = false;
      
      processorRef.current.reset();
      // No iniciamos audio aquí, está centralizado en PPGSignalMeter
    }
    
    setCurrentBPM(0);
    setConfidence(0);
    setIsArrhythmia(false);
    setLastPeakTime(null);
    
    missedBeepsCounter.current = 0;
    lastProcessedPeakTimeRef.current = 0;
    
    cleanupBeepProcessor();
    resetArrhythmia();
  }, [cleanupBeepProcessor, resetArrhythmia]);

  const startMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Starting monitoring');
    if (processorRef.current) {
      isMonitoringRef.current = true;
      processorRef.current.startMonitoring();
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
      processorRef.current.stopMonitoring();
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
    isArrhythmia,
    arrhythmiaPhase,
    baseRR,
    baseSDNN,
    beats,
    requestBeep,
    startMonitoring,
    stopMonitoring
  };
};
