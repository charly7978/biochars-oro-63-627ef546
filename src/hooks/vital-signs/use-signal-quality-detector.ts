
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useState, useCallback } from 'react';
import { checkSignalQuality } from '../../modules/heart-beat/signal-quality';

/**
 * Enhanced hook that detects finger presence based on consistent rhythmic patterns
 * Uses physiological characteristics of human finger (heartbeat patterns)
 */
export const useSignalQualityDetector = () => {
  // Buffer de señal para análisis (últimos 5 segundos)
  const signalBufferRef = useRef<number[]>([]);
  const lastQualityRef = useRef<number>(0);
  const fingerDetectionWindowRef = useRef<number>(0);
  const fingerDetectedRef = useRef<boolean>(false);

  // Parámetros fisiológicos ajustados para máxima robustez y cero falsos positivos
  const SAMPLE_RATE = 30; // Hz
  const BUFFER_SIZE = SAMPLE_RATE * 5; // 5 segundos
  const AMP_MIN = 0.035; // Incrementado para evitar ruidos falsos
  const AMP_MAX = 0.30; // Límite superior razonable incrementado
  const PERIODICITY_MIN = 0.5; // Mayor umbral para periodicidad
  const STABILITY_MIN = 0.5; // Mejor estabilidad mínima requerida
  const NOISE_MAX = 0.025; // Umbral estricto para ruido aceptable
  const FLATLINE_STDDEV = 0.0025; // Umbral más estricto para descartar aplanamiento
  const SATURATION_THRESH = 0.90; // Umbral menor para saturación permitida
  const FINGER_CONFIRM_WINDOW = SAMPLE_RATE * 3; // Confirmar en 3 segundos máximo para evitar falsos positivos

  // API: detectWeakSignal
  const detectWeakSignal = (value: number): boolean => {
    // Actualizar buffer
    signalBufferRef.current.push(value);
    if (signalBufferRef.current.length > BUFFER_SIZE) signalBufferRef.current.shift();
    const buf = signalBufferRef.current;
    if (buf.length < SAMPLE_RATE) return true; // No hay suficiente señal

    // Estadísticas
    const amp = Math.max(...buf) - Math.min(...buf);
    const mean = buf.reduce((a, b) => a + b, 0) / buf.length;
    const variance = buf.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / buf.length;
    const stdDev = Math.sqrt(variance);
    const isFlat = stdDev < FLATLINE_STDDEV;
    const isSaturated = buf.filter(v => Math.abs(v) > SATURATION_THRESH).length > buf.length * 0.12;
    // Periodicidad (autocorrelación máxima)
    function autocorr(sig: number[], lag: number) {
      let sum = 0;
      for (let i = 0; i < sig.length - lag; i++) {
        sum += (sig[i] - mean) * (sig[i + lag] - mean);
      }
      return sum / (sig.length - lag);
    }
    let periodicityScore = 0;
    for (let lag = 15; lag <= 40; lag++) { // rango fisiológico aumentado 0.5-1.3s
      const ac = autocorr(buf, lag);
      if (ac > periodicityScore) periodicityScore = ac;
    }
    periodicityScore = Math.max(0, Math.min(1, periodicityScore / (variance || 1)));
    // Ruido: varianza de la derivada, umbral estricto
    const diffs = buf.slice(1).map((v, i) => v - buf[i]);
    const noise = Math.sqrt(diffs.reduce((s, v) => s + v * v, 0) / diffs.length);
    const noiseScore = 1 - Math.min(1, noise / NOISE_MAX);
    // Amplitud normalizada estricta
    const ampScore = Math.max(0, Math.min(1, (amp - AMP_MIN) / (AMP_MAX - AMP_MIN)));
    // Estabilidad (1 - coeficiente de variación) más severo
    const stabilityScore = 1 - Math.min(1, stdDev / (mean === 0 ? 1 : Math.abs(mean)));
    // Penalizaciones ajustadas para aplanado y saturación
    const flatPenalty = isFlat ? 0 : 1;
    const satPenalty = isSaturated ? 0 : 1;
    // Calidad compuesta muy estricta
    let quality = (
      0.40 * ampScore +
      0.35 * periodicityScore +
      0.15 * stabilityScore +
      0.10 * noiseScore
    ) * flatPenalty * satPenalty;
    // Suavizado temporal EMA fuerte
    if (!lastQualityRef.current) lastQualityRef.current = quality;
    quality = 0.08 * quality + 0.92 * lastQualityRef.current;
    lastQualityRef.current = quality;
    quality = Math.round(quality * 100);

    // Detectar dedo solo si todos los factores son óptimos
    const fingerDetected = (
      ampScore > AMP_MIN &&
      periodicityScore > PERIODICITY_MIN &&
      stabilityScore > STABILITY_MIN &&
      !isFlat &&
      !isSaturated
    );

    // Ventana ampliada para robustez, evitando falsos positivos
    if (fingerDetected) {
      fingerDetectionWindowRef.current++;
      if (fingerDetectionWindowRef.current > FINGER_CONFIRM_WINDOW) fingerDetectedRef.current = true;
    } else {
      fingerDetectionWindowRef.current = 0;
      fingerDetectedRef.current = false;
    }

    // Logs para depuración
    if (process.env.NODE_ENV !== 'production') {
      console.log('[SignalQualityDetector] amp:', ampScore.toFixed(3), 'per:', periodicityScore.toFixed(3), 'stab:', stabilityScore.toFixed(3), 'noise:', noiseScore.toFixed(3), 'flat:', isFlat, 'sat:', isSaturated, 'qual:', quality, 'finger:', fingerDetectedRef.current);
    }

    // Señal débil si no hay dedo o calidad baja
    return !fingerDetectedRef.current || quality < 55;
  };

  // API: isFingerDetected
  const isFingerDetected = useCallback(() => {
    return fingerDetectedRef.current;
  }, []);

  // API: reset
  const reset = () => {
    signalBufferRef.current = [];
    lastQualityRef.current = 0;
    fingerDetectionWindowRef.current = 0;
    fingerDetectedRef.current = false;
  };

  return {
    detectWeakSignal,
    isFingerDetected,
    reset,
    signalBufferRef,
    lastQualityRef,
    fingerDetectionWindowRef,
    fingerDetectedRef
  };
};

