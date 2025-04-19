
// Mejoras en la detección de dedo para robustez y evitar falsos positivos

import { useRef, useCallback } from 'react';

/**
 * Hook reforzado para detección activa y precisa de dedo humano en cámara
 * Combina análisis de forma de onda PPG, periodicidad, estabilidad y ruido
 * Evita total falsos positivos y mejora calidad general de captura
 */
export const useSignalQualityDetector = () => {
  const signalBufferRef = useRef<number[]>([]);
  const fingerDetectedRef = useRef(false);
  const fingerConfirmationCountRef = useRef(0);

  // Parámetros afinados
  const SAMPLE_RATE = 30;
  const BUFFER_SECONDS = 8;
  const BUFFER_SIZE = SAMPLE_RATE * BUFFER_SECONDS;

  // Thresholds fisiológicos directos para pulso
  const MIN_AMPLITUDE = 0.05;
  const MAX_AMPLITUDE = 0.45;
  const MIN_AUTOCORR = 0.58;
  const MAX_COV = 0.10;
  const MAX_NOISE = 0.018;
  const MIN_CONFIRMATION_FRAMES = SAMPLE_RATE * 3; // 3 seg robustos para confirmar dedo

  // Calcula autocorrelación normalizada simple
  const autocorrelation = (signal: number[], lag: number) => {
    const n = signal.length;
    if (lag >= n) return 0;
    const mean = signal.reduce((a,b) => a+b, 0) / n;
    let numerator = 0, denomLeft=0, denomRight=0;
    for (let i=0; i<n-lag; i++) {
      const left = signal[i] - mean;
      const right = signal[i+lag] - mean;
      numerator += left * right;
      denomLeft += left * left;
      denomRight += right * right;
    }
    const denom = Math.sqrt(denomLeft) * Math.sqrt(denomRight);
    return denom === 0 ? 0 : numerator / denom;
  };

  // Coeficiente de variación absoluto (std / mean abs)
  const coefficientOfVariation = (values: number[]) => {
    if (values.length === 0) return 1;
    const meanAbs = values.reduce((a,b) => a + Math.abs(b), 0) / values.length;
    if (meanAbs === 0) return 1;
    const variance = values.reduce((a,b) => a + Math.pow(b - meanAbs, 2), 0) / values.length;
    return Math.sqrt(variance) / meanAbs;
  };

  // Ruido RMS diferencia entre muestras consecutivas (derivada rms)
  const rmsNoise = (values: number[]) => {
    if (values.length < 2) return 0;
    let sumSqDiff = 0;
    for (let i=1; i<values.length; i++) {
      const diff = values[i] - values[i-1];
      sumSqDiff += diff*diff;
    }
    return Math.sqrt(sumSqDiff / (values.length -1));
  };

  // Función principal para detectar dedo con criterios estrictos
  const detectFinger = useCallback((value: number) => {
    if (value == null || isNaN(value)) {
      fingerDetectedRef.current = false;
      fingerConfirmationCountRef.current = 0;
      signalBufferRef.current = [];
      return false;
    }

    const buf = signalBufferRef.current;
    buf.push(value);
    if (buf.length > BUFFER_SIZE) buf.shift();

    if (buf.length < BUFFER_SIZE) {
      fingerDetectedRef.current = false;
      fingerConfirmationCountRef.current = 0;
      return false;
    }

    const minVal = Math.min(...buf);
    const maxVal = Math.max(...buf);
    const amplitude = maxVal - minVal;

    // Rechazar si amplitud fuera de rango fisiológico
    if (amplitude < MIN_AMPLITUDE || amplitude > MAX_AMPLITUDE) {
      fingerConfirmationCountRef.current = 0;
      fingerDetectedRef.current = false;
      return false;
    }

    // Buscar periodicidad máxima en rango 12-40 (0.4 a 1.3 seg) en autocorrelación
    let maxAutocorr = -Infinity;
    for (let lag=12; lag<=40; lag++) {
      const ac = autocorrelation(buf, lag);
      if (ac > maxAutocorr) maxAutocorr = ac;
    }

    if (maxAutocorr < MIN_AUTOCORR) {
      fingerConfirmationCountRef.current = 0;
      fingerDetectedRef.current = false;
      return false;
    }

    // Calcular coeficiente de variación para estabilidad
    const cov = coefficientOfVariation(buf);
    if (cov > MAX_COV) {
      fingerConfirmationCountRef.current = 0;
      fingerDetectedRef.current = false;
      return false;
    }

    // Ruido de derivada rms bajo límite
    const noise = rmsNoise(buf);
    if (noise > MAX_NOISE) {
      fingerConfirmationCountRef.current = 0;
      fingerDetectedRef.current = false;
      return false;
    }

    // Acumular sólo si señal cumple todos los criterios anteriores
    fingerConfirmationCountRef.current++;

    if (fingerConfirmationCountRef.current >= MIN_CONFIRMATION_FRAMES) {
      fingerDetectedRef.current = true;
    } else {
      fingerDetectedRef.current = false;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug("[useSignalQualityDetector] Amplitude:", amplitude.toFixed(3),
        "MaxAutoCorr:", maxAutocorr.toFixed(3),
        "CoV:", cov.toFixed(3),
        "Noise:", noise.toFixed(3),
        "ConfirmationCount:", fingerConfirmationCountRef.current,
        "FingerDetected:", fingerDetectedRef.current);
    }

    return fingerDetectedRef.current;
  }, []);

  // Reset completo del detector
  const reset = useCallback(() => {
    signalBufferRef.current = [];
    fingerDetectedRef.current = false;
    fingerConfirmationCountRef.current = 0;
  }, []);

  return {
    detectFinger,
    isFingerDetected: () => fingerDetectedRef.current,
    reset
  };
};

