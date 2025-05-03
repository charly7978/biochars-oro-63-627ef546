/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { HeartBeatConfig } from './config'; // Ensure this import is present

/**
 * Functions for detecting peaks in PPG signals
 */

/**
 * Detects if the current sample represents a peak in the signal
 */
export function detectPeak(
  normalizedValue: number,
  derivative: number,
  baseline: number,
  lastValue: number,
  lastPeakTime: number | null,
  currentTime: number,
  config: {
    minPeakTimeMs: number,
    derivativeThreshold: number,
    signalThreshold: number,
  }
): {
  isPeak: boolean;
  confidence: number;
} {
  // Check minimum time between peaks
  if (lastPeakTime !== null) {
    const timeSinceLastPeak = currentTime - lastPeakTime;
    if (timeSinceLastPeak < config.minPeakTimeMs) {
      return { isPeak: false, confidence: 0 };
    }
  }

  // Peak detection logic
  const isPeak =
    derivative < config.derivativeThreshold &&
    normalizedValue > config.signalThreshold &&
    lastValue > baseline * 0.98;

  // Calculate confidence based on signal characteristics
  const amplitudeConfidence = Math.min(
    Math.max(Math.abs(normalizedValue) / (config.signalThreshold * 1.8), 0),
    1
  );
  
  const derivativeConfidence = Math.min(
    Math.max(Math.abs(derivative) / Math.abs(config.derivativeThreshold * 0.8), 0),
    1
  );

  // Combined confidence score
  const confidence = (amplitudeConfidence + derivativeConfidence) / 2;

  return { isPeak, confidence };
}

/**
 * Detecta y confirma un pico potencial en la señal PPG normalizada.
 * Incorpora umbral adaptativo y realiza una confirmación simple.
 */
export function detectAndConfirmPeak(
  normalizedValue: number,
  derivative: number,
  lastValue: number, 
  currentTime: number,
  state: PeakDetectionState,
  config: {
    minPeakTimeMs: number;
    derivativeThreshold: number;
    minConfidence: number; // Añadir minConfidence aquí
  }
): { 
    isPeakCandidate: boolean; // Si cumple condiciones iniciales
    isPeakConfirmed: boolean; // Si pasa la confirmación simple
    confidence: number; 
    updatedState: PeakDetectionState 
} {
  let isPeakCandidate = false;
  let isPeakConfirmed = false;
  let confidence = 0;
  let updatedState = { ...state }; // Copiar estado para modificar

  // 1. Condición básica de pico candidato
  if (normalizedValue > updatedState.adaptiveThreshold && 
      normalizedValue > updatedState.minPeakValue && 
      derivative < config.derivativeThreshold && 
      lastValue >= normalizedValue) { 
    
    // 2. Verificar período refractario y tiempo mínimo entre picos
    if (updatedState.lastPeakTime === null || (currentTime - updatedState.lastPeakTime) >= config.minPeakTimeMs) {
        isPeakCandidate = true;
        confidence = Math.min(1, normalizedValue / (updatedState.adaptiveThreshold * 2)); 
        
        // 3. Confirmación SIMPLE (para depuración):
        // Confirmar si es candidato y supera la confianza mínima.
        // (La validación de no confirmar picos consecutivos se hará en HeartRateService)
        if (confidence >= config.minConfidence) {
            isPeakConfirmed = true;
            // Actualizar lastPeakTime en el estado *solo si se confirma*
            updatedState.lastPeakTime = currentTime; 
        }
    }
  }

  // 4. Actualizar umbral adaptativo (se hace independientemente de si hay pico)
  if (normalizedValue > updatedState.minPeakValue * 0.5) {
      updatedState.recentAmplitudes.push(normalizedValue);
      if (updatedState.recentAmplitudes.length > AMPLITUDE_BUFFER_SIZE) {
          updatedState.recentAmplitudes.shift();
      }
  }
  if (updatedState.recentAmplitudes.length > ADAPTIVE_THRESHOLD_WINDOW) {
      const recentSorted = [...updatedState.recentAmplitudes].sort((a, b) => a - b);
      const percentileIndex = Math.floor(recentSorted.length * 0.65);
      const amplitudeBase = recentSorted[percentileIndex];
      const newAdaptiveThreshold = Math.max(
          updatedState.minPeakValue, 
          amplitudeBase * 0.4 + updatedState.noiseLevelEstimate 
      );
      updatedState.adaptiveThreshold = updatedState.adaptiveThreshold * 0.8 + newAdaptiveThreshold * 0.2;
  }

  return { isPeakCandidate, isPeakConfirmed, confidence, updatedState };
}

/**
 * Obtiene el estado inicial para la detección de picos.
 */
export function getInitialPeakDetectionState(): PeakDetectionState {
    return JSON.parse(JSON.stringify(PEAK_STATE_DEFAULTS));
}

// --- Constantes y Tipos --- 

// Estado para umbral adaptativo
interface PeakDetectionState {
  lastPeakTime: number | null;
  adaptiveThreshold: number;
  noiseLevelEstimate: number;
  recentAmplitudes: number[]; 
  minPeakValue: number; 
}

// Estado de confirmación eliminado por ahora
/*
export interface PeakConfirmationState {
  buffer: number[]; 
  lastConfirmedPeak: boolean;
}
*/

const PEAK_STATE_DEFAULTS: PeakDetectionState = {
  lastPeakTime: null,
  adaptiveThreshold: HeartBeatConfig.SIGNAL_THRESHOLD, 
  noiseLevelEstimate: 0.05, 
  recentAmplitudes: [],
  minPeakValue: HeartBeatConfig.SIGNAL_THRESHOLD * 0.4 
};

// Constantes para lógica
const ADAPTIVE_THRESHOLD_WINDOW = 15; 
const AMPLITUDE_BUFFER_SIZE = 20;
// Constantes de confirmación no usadas directamente ahora
// const CONFIRMATION_WINDOW_SIZE = 5;
// const MIN_PEAK_PROMINENCE_FACTOR = 0.4; 
// const MAX_PEAK_WIDTH_SAMPLES = 8; 
const REFRACTORY_PERIOD_MS = HeartBeatConfig.MIN_PEAK_TIME_MS * 0.6; 
