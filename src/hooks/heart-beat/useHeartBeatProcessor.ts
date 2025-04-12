/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../../modules/HeartBeatProcessor';
import { HeartBeatResult, RRIntervalData } from '@/core/types';
import { useBeepProcessor } from './beep-processor';

/**
 * Hook para el procesamiento de la señal del latido cardíaco
 * Versión simplificada que usa el HeartBeatProcessor existente
 */
export interface UseHeartBeatReturn {
  lastSignal: boolean;
  currentBPM: number;
  confidence: number;
  processSignal: (value: number) => HeartBeatResult;
  reset: () => void;
  isArrhythmia: boolean;
  requestBeep: (value: number) => boolean;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  arrhythmiaCount?: number;
  lastFilteredValue: number | null;
  lastRRData: RRIntervalData | null;
}

export const useHeartBeatProcessor = (): UseHeartBeatReturn => {
  const processorRef = useRef<HeartBeatProcessor>(new HeartBeatProcessor());
  const [currentBPM, setCurrentBPM] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const [arrhythmiaCount, setArrhythmiaCount] = useState(0);
  const [lastFilteredValue, setLastFilteredValue] = useState<number | null>(null);
  const [lastRRData, setLastRRData] = useState<RRIntervalData | null>(null);

  const processSignal = useCallback((value: number): HeartBeatResult => {
    const processor = processorRef.current;
    if (!processor) {
      return { bpm: 0, confidence: 0, isPeak: false, arrhythmiaCount: 0 };
    }

    const result = processor.processSignal(value);

    if (result.bpm !== currentBPM || result.confidence !== confidence) {
      setCurrentBPM(result.bpm);
      setConfidence(result.confidence);
    }
    setArrhythmiaCount(result.arrhythmiaCount);
    setLastFilteredValue(result.filteredValue ?? null);
    setLastRRData(result.rrData ?? null);

    return result;
  }, [currentBPM, confidence]);

  const reset = useCallback(() => {
    processorRef.current?.reset();
    setCurrentBPM(0);
    setConfidence(0);
    setIsArrhythmia(false);
    setArrhythmiaCount(0);
    setLastFilteredValue(null);
    setLastRRData(null);
  }, []);

  const startMonitoring = useCallback(() => {
    processorRef.current?.setMonitoring(true);
    processorRef.current?.reset();
    processorRef.current?.initAudio().catch(err => console.error("Audio init failed:", err));
  }, []);

  const stopMonitoring = useCallback(() => {
    processorRef.current?.setMonitoring(false);
  }, []);

  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    currentBPM,
    confidence,
    processSignal,
    reset,
    isArrhythmia,
    requestBeep: (v: number) => false,
    startMonitoring,
    stopMonitoring,
    arrhythmiaCount,
    lastFilteredValue,
    lastRRData
  };
};
