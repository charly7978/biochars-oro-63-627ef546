import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { useBeepProcessor } from './heart-beat/beep-processor';
import { useSignalProcessor } from './heart-beat/signal-processor';
import { useArrhythmiaPatternDetector } from './heart-beat/arrhythmia-pattern-detector';
import { HeartBeatResult, UseHeartBeatReturn } from './heart-beat/types';

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [isArrhythmia, setIsArrhythmia] = useState<boolean>(false);
  const [lastPeakTime, setLastPeakTime] = useState<number | null>(null);

  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const isMonitoringRef = useRef<boolean>(false);
  
  const {
    requestImmediateBeep,
    cleanup: cleanupBeepProcessor
  } = useBeepProcessor();

  const {
    processSignal: processSignalInternal,
    reset: resetSignalProcessor,
    lastPeakTimeRef,
    lastValidBpmRef
  } = useSignalProcessor();

  // Nuevo detector de patrón de arritmia incluido
  const {
    phase: arrhythmiaPhase,
    baseRR,
    baseSDNN,
    beats,
    registerBeat,
    reset: resetArrhythmia
  } = useArrhythmiaPatternDetector();

  useEffect(() => {
    if (!processorRef.current) {
      processorRef.current = new HeartBeatProcessor();
      isMonitoringRef.current = true;
      if (typeof window !== 'undefined' && !window.heartBeatProcessor) {
        window.heartBeatProcessor = processorRef.current;
      }
    }

    return () => {
      if (processorRef.current) {
        if (typeof processorRef.current.stopMonitoring === 'function') {
          processorRef.current.stopMonitoring();
        }
        processorRef.current = null;
        if (typeof window !== 'undefined') window.heartBeatProcessor = undefined;
      }
    };
  }, []);

  const requestBeep = useCallback((value: number): boolean => {
    // Beep centralizado en PPGSignalMeter
    return false;
  }, []);

  const processSignal = useCallback((value: number): HeartBeatResult => {
    if (!processorRef.current) {
      const empty: HeartBeatResult = {
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
      return empty;
    }

    const result = processSignalInternal(
      value,
      currentBPM,
      confidence,
      processorRef.current,
      requestBeep,
      isMonitoringRef,
      undefined, // lastRRIntervalsRef not needed here
      undefined  // currentBeatIsArrhythmiaRef not needed here
    );

    // Actualizar estado si valores confiables
    if (result.bpm > 0 && result.confidence > 0.4) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    // Registrar beat para detección de arritmia
    if (result.isPeak) {
      registerBeat();
      setLastPeakTime(Date.now());
    }

    // Actualizar detección de arritmia en base a beats marcados
    const anomalousBeats = beats.filter(b => b.isAnomalous);
    setIsArrhythmia(anomalousBeats.length > 0);

    return {
      bpm: result.bpm,
      confidence: result.confidence,
      isPeak: result.isPeak,
      arrhythmiaCount: anomalousBeats.length,
      isArrhythmia: anomalousBeats.length > 0,
      rrData: {
        intervals: beats.map(b => b.rr),
        lastPeakTime: lastPeakTime
      }
    };
  }, [processSignalInternal, currentBPM, confidence, registerBeat, beats, lastPeakTime]);

  const reset = useCallback(() => {
    if (processorRef.current && typeof processorRef.current.reset === 'function') {
      processorRef.current.reset();
    }
    resetSignalProcessor();
    lastValidBpmRef.current = 0;
    setCurrentBPM(0);
    setConfidence(0);
    setIsArrhythmia(false);
    setLastPeakTime(null);
    cleanupBeepProcessor();
    resetArrhythmia();
  }, [resetSignalProcessor, cleanupBeepProcessor, resetArrhythmia]);

  const startMonitoring = useCallback(() => {
    if (processorRef.current && typeof processorRef.current.startMonitoring === 'function') {
      isMonitoringRef.current = true;
      processorRef.current.startMonitoring();
    }
  }, []);

  const stopMonitoring = useCallback(() => {
    if (processorRef.current && typeof processorRef.current.stopMonitoring === 'function') {
      isMonitoringRef.current = false;
      processorRef.current.stopMonitoring();
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
    stopMonitoring,
    lastPeakTime
  };
};
