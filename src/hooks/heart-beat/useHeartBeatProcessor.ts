
import { useState, useEffect, useRef, useCallback } from 'react';
import { HeartBeatProcessor } from '../../modules/HeartBeatProcessor';
import { HeartBeatResult } from '@/core/types';
import { useArrhythmiaDetector } from './arrhythmia-detector';

/**
 * Hook para procesamiento preciso de frecuencia cardíaca desde señal PPG real,
 * con cálculo robusto BPM basado en ventana temporal, detección avanzada de picos y arritmias.
 */
export const useHeartBeatProcessor = () => {
  const [heartBeatResult, setHeartBeatResult] = useState<HeartBeatResult>({
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: 0,
    rrData: { intervals: [], lastPeakTime: null },
    isArrhythmia: false
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isArrhythmia, setIsArrhythmia] = useState(false);

  const processorRef = useRef<HeartBeatProcessor | null>(null);
  const isMonitoringRef = useRef(false);
  const lastBpmRef = useRef(0);
  
  // Hook detector de arritmia basado en análisis RR
  const {
    detectArrhythmia,
    lastRRIntervalsRef: arrhythmiaRRRef,
    reset: resetArrhythmiaDetector
  } = useArrhythmiaDetector();

  useEffect(() => {
    if (!processorRef.current) {
      processorRef.current = new HeartBeatProcessor();
      if (typeof window !== 'undefined') window.heartBeatProcessor = processorRef.current;
    }
  }, []);

  /**
   * Procesa cada nuevo valor PPG, aplica detección, cálculo BPM y estado arrítmico
   * Solo se usa procesamiento de valores reales, sin simulación ni promedios arbitrarios
   */
  const processSignal = useCallback((value: number) => {
    if (!processorRef.current || !isMonitoringRef.current) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: value,
        arrhythmiaCount: 0,
        rrData: { intervals: [], lastPeakTime: null },
        isArrhythmia: false
      };
    }

    try {
      const result = processorRef.current.processSignal(value);
      const rrData = processorRef.current.getRRIntervals();

      if (rrData && rrData.intervals) {
        arrhythmiaRRRef.current = rrData.intervals;
      }

      const arrhythmiaDetection = detectArrhythmia(arrhythmiaRRRef.current);
      setIsArrhythmia(arrhythmiaDetection.isArrhythmia);

      const updatedArrhythmiaCount = arrhythmiaDetection.isArrhythmia
        ? (heartBeatResult.arrhythmiaCount + 1)
        : heartBeatResult.arrhythmiaCount;

      const updatedResult: HeartBeatResult = {
        ...result,
        arrhythmiaCount: updatedArrhythmiaCount,
        isArrhythmia: arrhythmiaDetection.isArrhythmia,
        rrData: {
          intervals: rrData.intervals,
          lastPeakTime: rrData.lastPeakTime
        }
      };

      setHeartBeatResult(updatedResult);
      lastBpmRef.current = result.bpm || lastBpmRef.current;

      return {
        ...updatedResult,
        filteredValue: value,
        rrData: {
          intervals: rrData.intervals,
          lastPeakTime: rrData.lastPeakTime
        }
      };
    } catch (error) {
      console.error('useHeartBeatProcessor: error procesando señal', error);
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: value,
        arrhythmiaCount: 0,
        rrData: { intervals: [], lastPeakTime: null },
        isArrhythmia: false
      };
    }
  }, [detectArrhythmia, heartBeatResult.arrhythmiaCount, arrhythmiaRRRef]);

  /**
   * Inicia el monitoreo
   */
  const startMonitoring = useCallback(() => {
    setIsProcessing(true);
    isMonitoringRef.current = true;
    if (processorRef.current) processorRef.current.reset();
    resetArrhythmiaDetector();
    setHeartBeatResult({
      bpm: 0,
      confidence: 0,
      isPeak: false,
      arrhythmiaCount: 0,
      rrData: { intervals: [], lastPeakTime: null },
      isArrhythmia: false
    });
  }, [resetArrhythmiaDetector]);

  /**
   * Detiene el monitoreo
   */
  const stopMonitoring = useCallback(() => {
    setIsProcessing(false);
    isMonitoringRef.current = false;
  }, []);

  /**
   * Reinicia internamente el hook y procesador
   */
  const reset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    resetArrhythmiaDetector();
    setHeartBeatResult({
      bpm: 0,
      confidence: 0,
      isPeak: false,
      arrhythmiaCount: 0,
      rrData: { intervals: [], lastPeakTime: null },
      isArrhythmia: false
    });
  }, [resetArrhythmiaDetector]);

  return {
    heartBeatResult,
    isProcessing,
    startProcessing: startMonitoring,
    stopProcessing: stopMonitoring,
    processSignal,
    reset,
    isArrhythmia,
    startMonitoring,
    stopMonitoring,
    lastBpm: lastBpmRef.current,
    hasBpmData: lastBpmRef.current > 0,
    isMonitoring: isMonitoringRef.current
  };
};
