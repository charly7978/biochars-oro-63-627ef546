import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { toast } from 'sonner';
import FeedbackService from '@/services/FeedbackService';

import { useBeepProcessor } from './heart-beat/beep-processor';
import { useSignalProcessor } from './heart-beat/signal-processor';
import { UseHeartBeatReturn, HeartBeatResult } from './heart-beat/types';
import { useArrhythmiaPatternDetector } from './heart-beat/arrhythmia-pattern-detector';

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const [currentBPM, setCurrentBPM] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [isArrhythmia, setIsArrhythmia] = useState<boolean>(false);
  const [lastPeakTime, setLastPeakTime] = useState<number | null>(null);

  // Control para evitar vibraciones repetidas muy rápidas
  const lastVibrationTimeRef = useRef<number>(0);
  const VIBRATION_COOLDOWN_MS = 1500;

  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));

  // Variables auxiliares para procesamiento y beep
  const missedBeepsCounter = useRef<number>(0);
  const isMonitoringRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);
  const lastProcessedPeakTimeRef = useRef<number>(0);

  // Refs necesarios para signal-processor
  const lastRRIntervalsRef = useRef<number[]>([]);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);

  // Hooks para beep y signal processing
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

  // Detector de patrón de arritmia
  const {
    phase: arrhythmiaPhase,
    baseRR,
    baseSDNN,
    beats,
    registerBeat,
    reset: resetArrhythmia
  } = useArrhythmiaPatternDetector();

  useEffect(() => {
    console.log('useHeartBeatProcessor: Inicializando procesador HeartBeatProcessor', { sessionId: sessionId.current });

    if (!processorRef.current) {
      try {
        processorRef.current = new HeartBeatProcessor();
        initializedRef.current = true;

        if (typeof window !== 'undefined') {
          (window as any).heartBeatProcessor = processorRef.current;
        }
      } catch (error) {
        console.error('Error inicializando HeartBeatProcessor:', error);
        toast.error('Error al inicializar el procesador de latidos');
      }
    }

    return () => {
      console.log('useHeartBeatProcessor: Limpiando procesador HeartBeatProcessor');

      if (processorRef.current) {
        processorRef.current.stopMonitoring();
        processorRef.current = null;
      }

      if (typeof window !== 'undefined') {
        (window as any).heartBeatProcessor = undefined;
      }
    };
  }, []);

  // No hacemos nada al solicitar beep aquí (centralizado en PPGSignalMeter)
  const requestBeep = useCallback((value: number): boolean => {
    return false;
  }, []);

  const processSignal = useCallback((value: number): HeartBeatResult => {
    // Loguear el valor recibido para procesamiento de latido
    console.log("[useHeartBeatProcessor] Valor recibido para latido:", value);
    if (!processorRef.current) {
      const emptyResult: HeartBeatResult = {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        arrhythmiaCount: 0,
        rrData: {
          intervals: [],
          lastPeakTime: null
        }
      };
      return emptyResult;
    }

    // Ejecutar procesado de señal real
    console.log('[useHeartBeatProcessor] Llamando a processSignalInternal con valor:', value);
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

    // Loguear si se detecta un pico
    if (result.isPeak) {
      console.log("[useHeartBeatProcessor] ¡Pico detectado!", result);
    }

    // Actualizar BPM si se tienen valores válidos y confianza aceptable
    if (result.bpm > 0 && result.confidence > 0.35) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }

    // Llamar a registerBeat solo si hay pico detectado
    if (result.isPeak) {
      registerBeat();
      setLastPeakTime(Date.now());
    }

    // Actualizar estado de arritmia basado en último latido detectado
    // El último beat del detector del patrón es más preciso para arritmias
    const lastBeat = beats.length > 0 ? beats[beats.length - 1] : null;
    let currentIsArrhythmia = false;
    if (lastBeat && lastBeat.isAnomalous) {
      currentIsArrhythmia = true;
    }
    setIsArrhythmia(currentIsArrhythmia);

    // Activar vibración solo si hay arritmia detectada y cooldown pasó
    const now = Date.now();
    if (currentIsArrhythmia && (now - lastVibrationTimeRef.current > VIBRATION_COOLDOWN_MS)) {
      console.log('useHeartBeatProcessor: Arritmia detectada, activando vibración');
      FeedbackService.vibrateArrhythmia();
      lastVibrationTimeRef.current = now;
    }

    // Exponer objeto resultado con datos consolidados para la UI
    const arrhythmiaCount = beats.filter(b => b.isAnomalous).length;

    const finalResult = {
      bpm: currentBPM,
      confidence,
      isPeak: result.isPeak,
      arrhythmiaCount,
      rrData: {
        intervals: beats.map(b => b.rr),
        lastPeakTime
      },
      isArrhythmia: currentIsArrhythmia
    };

    return finalResult;
  }, [currentBPM, confidence, beats, lastPeakTime, registerBeat]);

  const reset = useCallback(() => {
    console.log('useHeartBeatProcessor: Reiniciando procesador');

    if (processorRef.current) {
      processorRef.current.stopMonitoring();
      processorRef.current.reset();
    }
    isMonitoringRef.current = false;

    setCurrentBPM(0);
    setConfidence(0);
    setIsArrhythmia(false);
    setLastPeakTime(null);
    missedBeepsCounter.current = 0;
    lastProcessedPeakTimeRef.current = 0;

    cleanupBeepProcessor();
    resetArrhythmia();
    resetSignalProcessor();
  }, [cleanupBeepProcessor, resetArrhythmia, resetSignalProcessor]);

  const startMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Iniciando monitoreo');
    if (processorRef.current) {
      isMonitoringRef.current = true;
      processorRef.current.startMonitoring();
    }
  }, []);

  const stopMonitoring = useCallback(() => {
    console.log('useHeartBeatProcessor: Deteniendo monitoreo');
    if (processorRef.current) {
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
    stopMonitoring
  };
};
