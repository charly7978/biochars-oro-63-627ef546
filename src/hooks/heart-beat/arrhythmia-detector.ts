
import { useRef, useCallback } from 'react';
import { RRAnalysisResult } from './types';

export function useArrhythmiaDetector() {
  const heartRateVariabilityRef = useRef<number>(0);
  const stabilityCounterRef = useRef<number>(0);
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);

  const detectArrhythmia = useCallback((rrIntervals: number[]): RRAnalysisResult => {
    if (rrIntervals.length < 3) {
      return {
        isArrhythmia: false,
        hrv: 0,
        rmssd: 0,
        rrVariation: 0,
        confidence: 0
      };
    }

    // Calcular RMSSD (Root Mean Square of Successive Differences)
    let sumSquaredDiffs = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      const diff = rrIntervals[i] - rrIntervals[i - 1];
      sumSquaredDiffs += diff * diff;
    }
    const rmssd = Math.sqrt(sumSquaredDiffs / (rrIntervals.length - 1));

    // Calcular variación porcentual como desviación estándar normalizada
    const mean = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
    const variance = rrIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rrIntervals.length;
    const stdDev = Math.sqrt(variance);
    const rrVariation = (stdDev / mean) * 100;

    // Umbrales basados en literatura médica para detección de arritmias
    // Detectar arritmias basadas en variabilidad excesiva (>20%)
    const isArrhythmia = rrVariation > 20 || rmssd > 120;
    
    // Actualizar referencias
    heartRateVariabilityRef.current = rrVariation;
    currentBeatIsArrhythmiaRef.current = isArrhythmia;
    
    // Estabilidad del análisis
    if (isArrhythmia === lastIsArrhythmiaRef.current) {
      stabilityCounterRef.current++;
    } else {
      stabilityCounterRef.current = 0;
      lastIsArrhythmiaRef.current = isArrhythmia;
    }

    return {
      isArrhythmia,
      hrv: rrVariation,
      rmssd,
      rrVariation,
      confidence: Math.min(1, stabilityCounterRef.current / 5)
    };
  }, []);

  const reset = useCallback(() => {
    heartRateVariabilityRef.current = 0;
    stabilityCounterRef.current = 0;
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    currentBeatIsArrhythmiaRef.current = false;
  }, []);

  return {
    detectArrhythmia,
    heartRateVariabilityRef,
    stabilityCounterRef,
    lastRRIntervalsRef,
    lastIsArrhythmiaRef,
    currentBeatIsArrhythmiaRef,
    reset
  };
}
