
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useCallback } from 'react';

/**
 * Hook mejorado para detección estricta de dedo humano
 * Se basa en análisis multi-métrica con una ventana extendida, patrones rítmicos y umbrales fisiológicos
 * Prioriza eliminar falsos positivos con un reconocimiento robusto de patrones fisiológicos reales
 */
export const useSignalQualityDetector = () => {
  // Buffer de señal para análisis detallado
  const signalBufferRef = useRef<number[]>([]);
  const fingerDetectedRef = useRef(false);
  const fingerDetectionCountRef = useRef(0);
  const lastDetectionTimeRef = useRef(0);

  // Parámetros ajustados para evitar falsos positivos
  const SAMPLE_RATE = 30; // Hz (30 fps)
  const BUFFER_LENGTH_SEC = 8; // ventana de 8 segundos para mejor estabilidad
  const BUFFER_SIZE = SAMPLE_RATE * BUFFER_LENGTH_SEC;

  // Parámetros fisiológicos de la señal PPG para dedo
  const MIN_AMPLITUDE = 0.04;  // amplitud mínima de pulso aceptada
  const MAX_AMPLITUDE = 0.5;   // límite superior razonable (sobre saturación)
  const MIN_PERIODICITY = 0.55; // autocorrelación mínima para ritmo estable
  const MAX_STABILITY_COEFVAR = 0.12; // coeficiente de variación máximo para estabilidad
  const MAX_NOISE_LEVEL = 0.02; // ruido aceptable (rms derivada)
  const MIN_FINGER_CONFIRM_FRAMES = SAMPLE_RATE * 2; // exigir 2 segundos seguidos con señal buena para confirmar dedo

  /**
   * Función de autocorrelación simple normalizada
   */
  const autocorrelation = (signal: number[], lag: number) => {
    const n = signal.length;
    if (lag >= n) return 0;
    const mean = signal.reduce((a,b) => a + b, 0) / n;
    let numerator = 0;
    let denomLeft = 0;
    let denomRight = 0;
    for (let i = 0; i < n - lag; i++) {
      const left = signal[i] - mean;
      const right = signal[i + lag] - mean;
      numerator += left * right;
      denomLeft += left * left;
      denomRight += right * right;
    }
    const denominator = Math.sqrt(denomLeft) * Math.sqrt(denomRight);
    return denominator === 0 ? 0 : numerator / denominator;
  };

  /**
   * Calcula el coeficiente de variación (stddev / media absoluta)
   */
  const coeficienteVariacion = (values: number[]) => {
    if (values.length === 0) return 1;
    const mean = values.reduce((a,b) => a + Math.abs(b), 0) / values.length;
    if (mean === 0) return 1;
    const variance = values.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stddev = Math.sqrt(variance);
    return stddev / mean;
  };

  /**
   * Calcula ruido como RMS de las diferencias sucesivas
   */
  const calcularRuido = (values: number[]) => {
    if (values.length < 2) return 0;
    let sumSquaredDiffs = 0;
    for (let i = 1; i < values.length; i++) {
      const diff = values[i] - values[i-1];
      sumSquaredDiffs += diff * diff;
    }
    const meanSquaredDiff = sumSquaredDiffs / (values.length - 1);
    return Math.sqrt(meanSquaredDiff);
  };

  /**
   * Main function que detecta si el dedo está presente en la lente
   * Recibe valor de PPG filtrado en rango [0..1]
   */
  const detectFinger = useCallback((value: number) => {
    if (value == null || isNaN(value)) {
      fingerDetectedRef.current = false;
      fingerDetectionCountRef.current = 0;
      return false;
    }

    // Actualizar buffer
    const buf = signalBufferRef.current;
    buf.push(value);
    if (buf.length > BUFFER_SIZE) buf.shift();

    // Requiere mínimo buffer para análisis fiable
    if (buf.length < BUFFER_SIZE) {
      fingerDetectedRef.current = false;
      fingerDetectionCountRef.current = 0;
      return false;
    }

    // Calcular amplitud y validación de rango
    const minVal = Math.min(...buf);
    const maxVal = Math.max(...buf);
    const amplitude = maxVal - minVal;

    if (amplitude < MIN_AMPLITUDE || amplitude > MAX_AMPLITUDE) {
      fingerDetectedRef.current = false;
      fingerDetectionCountRef.current = 0;
      return false;
    }

    // Calcular periodicidad máxima mediante autocorrelación en rangos fisiológicos
    let maxAutocorr = 0;
    for (let lag = 12; lag <= 40; lag++) {
      const ac = autocorrelation(buf, lag);
      if (ac > maxAutocorr) maxAutocorr = ac;
    }

    if (maxAutocorr < MIN_PERIODICITY) {
      fingerDetectedRef.current = false;
      fingerDetectionCountRef.current = 0;
      return false;
    }

    // Calcular estabilidad (coef de variación)
    const cv = coeficienteVariacion(buf);
    if (cv > MAX_STABILITY_COEFVAR) {
      fingerDetectedRef.current = false;
      fingerDetectionCountRef.current = 0;
      return false;
    }

    // Calcular ruido como rms de derivada
    const noise = calcularRuido(buf);
    if (noise > MAX_NOISE_LEVEL) {
      fingerDetectedRef.current = false;
      fingerDetectionCountRef.current = 0;
      return false;
    }

    // Señal robusta detectada, aumentar contador para confirmar dedo
    fingerDetectionCountRef.current++;
    if (fingerDetectionCountRef.current >= MIN_FINGER_CONFIRM_FRAMES) {
      fingerDetectedRef.current = true;
    } else {
      fingerDetectedRef.current = false;
    }

    // Logs útiles para debugging en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.debug("[useSignalQualityDetector] amplitude:", amplitude.toFixed(4),
        "maxAutoCorr:", maxAutocorr.toFixed(4),
        "cv:", cv.toFixed(4),
        "noise:", noise.toFixed(4),
        "framesDetected:", fingerDetectionCountRef.current,
        "fingerDetected:", fingerDetectedRef.current);
    }

    return fingerDetectedRef.current;
  }, []);

  /**
   * Resetea estado interno del detector
   */
  const reset = useCallback(() => {
    fingerDetectedRef.current = false;
    fingerDetectionCountRef.current = 0;
    signalBufferRef.current = [];
    lastDetectionTimeRef.current = 0;
  }, []);

  return {
    detectFinger,
    isFingerDetected: () => fingerDetectedRef.current,
    reset
  };
};

