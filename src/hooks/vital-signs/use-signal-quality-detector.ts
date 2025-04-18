/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useState, useCallback } from 'react';
// Eliminamos checkSignalQuality si no se usa en otro lugar
// import { checkSignalQuality } from '../../modules/heart-beat/signal-quality';
import { PeakDetector } from '@/core/signal/PeakDetector'; // Importamos PeakDetector

/**
 * Enhanced hook that detects finger presence based on consistent rhythmic patterns
 * Uses physiological characteristics of human finger (heartbeat patterns)
 */
export const useSignalQualityDetector = () => {
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = 0.25;
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 5;

  // Finger detection state
  const signalHistoryRef = useRef<Array<{time: number, value: number}>>([]);
  const lastPeakTimesRef = useRef<number[]>([]); // Mantenido por si es útil externamente
  const detectedRhythmicPatternsRef = useRef<number>(0);
  const fingerDetectionConfirmedRef = useRef<boolean>(false);

  // Instancia del PeakDetector
  const peakDetectorRef = useRef<PeakDetector>(new PeakDetector());

  // Constants for pattern detection
  const PATTERN_DETECTION_WINDOW_MS = 3000;
  const MIN_PEAKS_FOR_RHYTHM = 4;
  const REQUIRED_CONSISTENT_PATTERNS = 4;
  const MIN_SIGNAL_VARIANCE = 0.04;

  /**
   * Detect peaks using the consolidated PeakDetector
   */
  const detectRhythmicPattern = useCallback(() => {
    const now = Date.now();
    const recentSignals = signalHistoryRef.current
      .filter(point => now - point.time < PATTERN_DETECTION_WINDOW_MS);

    if (recentSignals.length < 15) return false;

    const values = recentSignals.map(s => s.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    if (variance < MIN_SIGNAL_VARIANCE) {
      detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
      console.log("Signal variance too low - rejecting pattern", { variance, threshold: MIN_SIGNAL_VARIANCE });
      return false;
    }

    // Usar PeakDetector
    const { intervals, peakIndices } = peakDetectorRef.current.detectPeaks(values);
    const peaks = peakIndices.map(idx => recentSignals[idx]?.time).filter(Boolean) as number[]; // Mapear índices a tiempos

    if (peaks.length >= MIN_PEAKS_FOR_RHYTHM) {
      // PeakDetector ya filtra intervalos inválidos en `intervals`
      const validIntervals = intervals;

      if (validIntervals.length < Math.floor((peaks.length -1) * 0.7)) {
        detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
        console.log("Intervals not physiologically plausible - rejecting pattern", { 
            validCount: validIntervals.length, 
            peakCount: peaks.length 
          });
        return false;
      }

      // Check for consistency in intervals (rhythm)
      let consistentIntervals = 0;
      const maxDeviation = 150;
      for (let i = 1; i < validIntervals.length; i++) {
        if (Math.abs(validIntervals[i] - validIntervals[i - 1]) < maxDeviation) {
          consistentIntervals++;
        }
      }

      if (consistentIntervals >= MIN_PEAKS_FOR_RHYTHM - 1) {
        lastPeakTimesRef.current = peaks; // Guardamos los tiempos de los picos
        detectedRhythmicPatternsRef.current++;
        console.log("Consistent rhythm detected", {
          consistentIntervals,
          totalValidIntervals: validIntervals.length,
          peakCount: peaks.length,
          meanInterval: validIntervals.length > 0 ? validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length : 0,
          patternCount: detectedRhythmicPatternsRef.current
        });

        if (detectedRhythmicPatternsRef.current >= REQUIRED_CONSISTENT_PATTERNS) {
          fingerDetectionConfirmedRef.current = true;
           console.log("Finger detection confirmed by consistent rhythm", {
             time: new Date(now).toISOString(),
             patternCount: detectedRhythmicPatternsRef.current,
             peaks: peaks.length
           });
          return true;
        }
      } else {
        detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
      }
    } else {
      detectedRhythmicPatternsRef.current = Math.max(0, detectedRhythmicPatternsRef.current - 1);
    }

    return fingerDetectionConfirmedRef.current;
  }, []); // Dependencias eliminadas ya que usamos refs y constantes

  /**
   * Enhanced detection function with physiological pattern recognition
   */
  const detectWeakSignal = (value: number): boolean => {
    const now = Date.now();
    signalHistoryRef.current.push({ time: now, value });
    signalHistoryRef.current = signalHistoryRef.current.filter(
      point => now - point.time < PATTERN_DETECTION_WINDOW_MS * 2
    );

    if (fingerDetectionConfirmedRef.current) {
      if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
        consecutiveWeakSignalsRef.current++;
        if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS * 2) {
          fingerDetectionConfirmedRef.current = false;
          detectedRhythmicPatternsRef.current = 0;
          peakDetectorRef.current.reset(); // Resetear PeakDetector también
        }
      } else {
        consecutiveWeakSignalsRef.current = Math.max(0, consecutiveWeakSignalsRef.current - 2);
      }
      return consecutiveWeakSignalsRef.current >= MAX_CONSECUTIVE_WEAK_SIGNALS;
    } else {
      if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
        consecutiveWeakSignalsRef.current++;
      } else {
        consecutiveWeakSignalsRef.current = Math.max(0, consecutiveWeakSignalsRef.current - 2);
      }

      // Llamar a la función refactorizada
      const hasRhythmicPattern = detectRhythmicPattern();

      if (hasRhythmicPattern) {
        consecutiveWeakSignalsRef.current = 0;
        return false;
      }

      return consecutiveWeakSignalsRef.current >= MAX_CONSECUTIVE_WEAK_SIGNALS;
    }
  };

  /**
   * Check if finger is detected based on rhythmic patterns
   */
  const isFingerDetected = useCallback((): boolean => {
    if (fingerDetectionConfirmedRef.current) {
      return consecutiveWeakSignalsRef.current < MAX_CONSECUTIVE_WEAK_SIGNALS * 2;
    }
    return detectedRhythmicPatternsRef.current >= REQUIRED_CONSISTENT_PATTERNS;
  }, []);

  /**
   * Reset the signal quality detector
   */
  const reset = () => {
    consecutiveWeakSignalsRef.current = 0;
    signalHistoryRef.current = [];
    lastPeakTimesRef.current = [];
    detectedRhythmicPatternsRef.current = 0;
    fingerDetectionConfirmedRef.current = false;
    peakDetectorRef.current.reset(); // Resetear PeakDetector
  };

  return {
    detectWeakSignal,
    isFingerDetected,
    reset,
    // Exponer refs y constantes puede ser útil para depuración o configuración externa
    consecutiveWeakSignalsRef,
    WEAK_SIGNAL_THRESHOLD,
    MAX_CONSECUTIVE_WEAK_SIGNALS,
    signalHistoryRef,
    lastPeakTimesRef,
    detectedRhythmicPatternsRef,
    fingerDetectionConfirmedRef,
    peakDetectorRef // Exponer la instancia si es necesario
  };
};
