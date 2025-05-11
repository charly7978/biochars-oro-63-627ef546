
import { useRef, useCallback, useState } from 'react';
import { HeartBeatResult } from './types';
import { useArrhythmiaDetector } from './arrhythmia-detector';
import { useBeepProcessor } from './beep-processor';

export function useSignalProcessor() {
  // Referencias para mantener el estado entre renders
  const signalDataRef = useRef<number[]>([]);
  const bpmHistoryRef = useRef<number[]>([]);
  const lastPeakTimeRef = useRef<number | null>(null);
  const peakThresholdRef = useRef<number>(0);
  const peakDetectedRef = useRef<boolean>(false);
  const arrhythmiaCountRef = useRef<number>(0);
  const confidenceRef = useRef<number>(0);
  const rrIntervalsRef = useRef<number[]>([]);
  const lastValidBpmRef = useRef<number>(0);
  const lastSignalQualityRef = useRef<number>(0);
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 5;
  
  // Obtener lógica de detección de arritmias
  const { detectArrhythmia, reset: resetArrhythmiaDetector } = useArrhythmiaDetector();
  const { requestImmediateBeep } = useBeepProcessor();

  const resetProcessor = useCallback(() => {
    signalDataRef.current = [];
    bpmHistoryRef.current = [];
    lastPeakTimeRef.current = null;
    peakThresholdRef.current = 0;
    peakDetectedRef.current = false;
    arrhythmiaCountRef.current = 0;
    confidenceRef.current = 0;
    rrIntervalsRef.current = [];
    lastValidBpmRef.current = 0;
    lastSignalQualityRef.current = 0;
    consecutiveWeakSignalsRef.current = 0;
    resetArrhythmiaDetector();
  }, [resetArrhythmiaDetector]);

  const processSignal = useCallback((value: number): HeartBeatResult => {
    // Agregar valor al buffer de señal
    signalDataRef.current.push(value);
    if (signalDataRef.current.length > 100) {
      signalDataRef.current.shift();
    }

    // Si no hay suficientes datos para procesar, devolver resultado inicial
    if (signalDataRef.current.length < 10) {
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

    // Detección de pico basada en umbral adaptativo
    const recentValues = signalDataRef.current.slice(-10);
    const average = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);

    // Umbral dinámico basado en la variación de la señal
    peakThresholdRef.current = average + 1.2 * stdDev;

    const currentTime = Date.now();
    const isPeak = value > peakThresholdRef.current && !peakDetectedRef.current;
    peakDetectedRef.current = value > peakThresholdRef.current;

    // Procesar pico si se detectó uno
    if (isPeak) {
      if (lastPeakTimeRef.current !== null) {
        // Calcular intervalo RR (en segundos)
        const rrInterval = (currentTime - lastPeakTimeRef.current) / 1000;
        
        // Solo considerar intervalos fisiológicamente plausibles (40-200 BPM)
        if (rrInterval > 0.3 && rrInterval < 1.5) {
          rrIntervalsRef.current.push(rrInterval);
          
          // Mantener un historial limitado de intervalos RR
          if (rrIntervalsRef.current.length > 10) {
            rrIntervalsRef.current.shift();
          }
          
          // Calcular BPM instantáneo
          const instantBpm = 60 / rrInterval;
          bpmHistoryRef.current.push(instantBpm);
          
          // Limitar el historial de BPM
          if (bpmHistoryRef.current.length > 5) {
            bpmHistoryRef.current.shift();
          }
          
          // Analizar si hay arritmia
          if (rrIntervalsRef.current.length >= 3) {
            const rrAnalysis = detectArrhythmia(rrIntervalsRef.current);
            
            if (rrAnalysis.isArrhythmia) {
              arrhythmiaCountRef.current++;
            }
            
            confidenceRef.current = rrAnalysis.confidence;
          }
          
          // Solicitar reproducción de sonido para este pico
          requestImmediateBeep(value);
        }
      }
      
      // Actualizar tiempo del último pico
      lastPeakTimeRef.current = currentTime;
    }

    // Calcular BPM promedio
    const averageBpm = bpmHistoryRef.current.length > 0
      ? bpmHistoryRef.current.reduce((sum, bpm) => sum + bpm, 0) / bpmHistoryRef.current.length
      : 0;

    // Calcular confianza basada en la consistencia de los intervalos RR
    let confidence = 0;
    if (rrIntervalsRef.current.length > 2) {
      // Mayor consistencia = mayor confianza
      const rrAverage = rrIntervalsRef.current.reduce((sum, val) => sum + val, 0) / rrIntervalsRef.current.length;
      const rrVariance = rrIntervalsRef.current.reduce((sum, val) => sum + Math.pow(val - rrAverage, 2), 0) / rrIntervalsRef.current.length;
      confidence = Math.max(0, Math.min(1, 1 - (Math.sqrt(rrVariance) / rrAverage) * 2));
    }

    // Detectar arritmias basadas en intervalos RR (análisis completo)
    let isArrhythmia = false;
    if (rrIntervalsRef.current.length >= 3) {
      const rrAnalysis = detectArrhythmia(rrIntervalsRef.current);
      isArrhythmia = rrAnalysis.isArrhythmia;
    }

    // Update lastValidBpm if we have a reasonable heart rate
    if (averageBpm >= 40 && averageBpm <= 200 && confidence > 0.4) {
      lastValidBpmRef.current = Math.round(averageBpm);
    }

    return {
      bpm: Math.round(averageBpm),
      confidence: confidence,
      isPeak,
      arrhythmiaCount: arrhythmiaCountRef.current,
      isArrhythmia,
      rrData: {
        intervals: [...rrIntervalsRef.current],
        lastPeakTime: lastPeakTimeRef.current
      }
    };
  }, [detectArrhythmia, requestImmediateBeep]);

  return {
    processSignal,
    resetProcessor,
    lastPeakTimeRef,
    lastValidBpmRef,
    lastSignalQualityRef,
    consecutiveWeakSignalsRef,
    MAX_CONSECUTIVE_WEAK_SIGNALS
  };
}
