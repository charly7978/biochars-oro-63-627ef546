
// Reforzar la detección confiable de dedo real y evitar falsas detecciones

import { useRef, useCallback } from 'react';

/**
 * Hook reforzado para detección activa y precisa de dedo humano en cámara
 * Algoritmo mejorado con análisis de estabilidad, periodicidad, amplitud y ruido
 */
export const useSignalQualityDetector = () => {
  const signalBufferRef = useRef<number[]>([]);
  const fingerDetectedRef = useRef(false);
  const lastFingerDetectedTimeRef = useRef<number>(0);
  const confirmationCountRef = useRef(0);

  const SAMPLE_RATE = 30;
  const BUFFER_SECONDS = 8;
  const BUFFER_SIZE = SAMPLE_RATE * BUFFER_SECONDS;

  const MIN_AMPLITUDE = 0.06;
  const MAX_AMPLITUDE = 0.45;
  const MIN_AUTOCORR = 0.60;
  const MAX_NOISE = 0.015;
  const MIN_CONFIRMATION_TIME_MS = SAMPLE_RATE * 4; // 4 segundos de confirmación

  // Cálculo autocorrelación normalizada simple
  const autocorrelation = (signal: number[], lag: number): number => {
    const n = signal.length;
    if (lag >= n) return 0;
    const mean = signal.reduce((acc, v) => acc + v, 0) / n;
    let numerator = 0, denomLeft = 0, denomRight = 0;
    for (let i = 0; i < n - lag; i++) {
      const left = signal[i] - mean;
      const right = signal[i + lag] - mean;
      numerator += left * right;
      denomLeft += left * left;
      denomRight += right * right;
    }
    const denom = Math.sqrt(denomLeft) * Math.sqrt(denomRight);
    return denom === 0 ? 0 : numerator / denom;
  };

  // Ruido RMS basado en derivada de la señal
  const rmsNoise = (values: number[]) => {
    if (values.length < 2) return 0;
    let sumSqDiff = 0;
    for (let i = 1; i < values.length; i++) {
      const diff = values[i] - values[i - 1];
      sumSqDiff += diff * diff;
    }
    return Math.sqrt(sumSqDiff / (values.length - 1));
  };

  // Función para detección robusta de dedo
  const detectFinger = useCallback((value: number) => {
    if (value == null || isNaN(value)) {
      fingerDetectedRef.current = false;
      confirmationCountRef.current = 0;
      signalBufferRef.current = [];
      return false;
    }

    const buf = signalBufferRef.current;
    buf.push(value);
    if (buf.length > BUFFER_SIZE) buf.shift();

    if (buf.length < BUFFER_SIZE) {
      fingerDetectedRef.current = false;
      confirmationCountRef.current = 0;
      return false;
    }

    const minVal = Math.min(...buf);
    const maxVal = Math.max(...buf);
    const amplitude = maxVal - minVal;

    if (amplitude < MIN_AMPLITUDE || amplitude > MAX_AMPLITUDE) {
      confirmationCountRef.current = 0;
      fingerDetectedRef.current = false;
      return false;
    }

    // Evaluar periodicidad autocorrelada en rango fisiológico
    let maxAutocorr = -Infinity;
    for (let lag = 12; lag <= 40; lag++) {
      const ac = autocorrelation(buf, lag);
      if (ac > maxAutocorr) maxAutocorr = ac;
    }

    if (maxAutocorr < MIN_AUTOCORR) {
      confirmationCountRef.current = 0;
      fingerDetectedRef.current = false;
      return false;
    }

    // Calcular ruido en derivada
    const noise = rmsNoise(buf);
    if (noise > MAX_NOISE) {
      confirmationCountRef.current = 0;
      fingerDetectedRef.current = false;
      return false;
    }

    // Confirmar detección estable durante el tiempo mínimo
    confirmationCountRef.current++;
    if (confirmationCountRef.current >= MIN_CONFIRMATION_TIME_MS) {
      fingerDetectedRef.current = true;
      lastFingerDetectedTimeRef.current = Date.now();
    } else {
      fingerDetectedRef.current = false;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug("[useSignalQualityDetector] Amplitude:", amplitude.toFixed(3),
        "MaxAutoCorr:", maxAutocorr.toFixed(3),
        "Noise:", noise.toFixed(3),
        "ConfirmCount:", confirmationCountRef.current,
        "FingerDetected:", fingerDetectedRef.current);
    }

    return fingerDetectedRef.current;
  }, []);

  const reset = useCallback(() => {
    signalBufferRef.current = [];
    fingerDetectedRef.current = false;
    confirmationCountRef.current = 0;
  }, []);

  return {
    detectFinger,
    isFingerDetected: () => fingerDetectedRef.current,
    reset
  };
};


