/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { HeartBeatConfig } from './config';

// --- Constantes y Tipos --- 

interface PeakDetectionState {
  lastPeakTime: number | null;
  adaptiveThreshold: number;
  noiseLevelEstimate: number;
  recentAmplitudes: number[]; // Buffer para calcular umbral adaptativo
  minPeakValue: number; // Umbral mínimo absoluto para considerar un pico
}

interface PeakConfirmationState {
  buffer: number[]; // Almacena valores normalizados si son picos candidatos
  lastConfirmedPeak: boolean;
}

const PEAK_STATE_DEFAULTS: PeakDetectionState = {
  lastPeakTime: null,
  adaptiveThreshold: HeartBeatConfig.SIGNAL_THRESHOLD, // Iniciar con valor de config
  noiseLevelEstimate: 0.05, // Estimación inicial de ruido
  recentAmplitudes: [],
  minPeakValue: HeartBeatConfig.SIGNAL_THRESHOLD * 0.4 // Mínimo absoluto
};

const CONFIRMATION_STATE_DEFAULTS: PeakConfirmationState = {
  buffer: [],
  lastConfirmedPeak: false,
};

const ADAPTIVE_THRESHOLD_WINDOW = 15; // Usar N picos/amplitudes para adaptar umbral
const AMPLITUDE_BUFFER_SIZE = 20;
const CONFIRMATION_WINDOW_SIZE = 5;
const MIN_PEAK_PROMINENCE_FACTOR = 0.4; // Pico debe ser 40% más alto que valles locales
const MAX_PEAK_WIDTH_SAMPLES = 8; // Pico no debe ser más ancho que esto (evita ruido ancho)
const REFRACTORY_PERIOD_MS = HeartBeatConfig.MIN_PEAK_TIME_MS * 0.6; // Periodo más corto post-pico

// --- Funciones Principales --- 

/**
 * Detecta un pico potencial en la señal PPG normalizada.
 * Incorpora umbral adaptativo y verifica condiciones básicas.
 */
export function detectPeak(
  normalizedValue: number,
  derivative: number,
  lastValue: number, // Valor normalizado anterior
  currentTime: number,
  state: PeakDetectionState,
  config: {
    minPeakTimeMs: number;
    derivativeThreshold: number;
    // SIGNAL_THRESHOLD ya no se pasa directamente, se usa state.adaptiveThreshold
  }
): { isPeakCandidate: boolean; confidence: number; updatedState: PeakDetectionState } {
  let isPeakCandidate = false;
  let confidence = 0;

  // 1. Condición básica de pico: Cruce por cero de derivada + valor sobre umbral adaptativo
  if (normalizedValue > state.adaptiveThreshold && 
      normalizedValue > state.minPeakValue && // Superar mínimo absoluto
      derivative < config.derivativeThreshold && // Pendiente descendente
      lastValue >= normalizedValue) { // Pico local (o estabilizado)
    
    // 2. Verificar período refractario y tiempo mínimo entre picos
    if (state.lastPeakTime === null || (currentTime - state.lastPeakTime) >= config.minPeakTimeMs) {
        isPeakCandidate = true;
        // Confianza básica basada en amplitud relativa al umbral adaptativo
        confidence = Math.min(1, normalizedValue / (state.adaptiveThreshold * 2)); 
    }
  }

  // 3. Actualizar umbral adaptativo (basado en ruido y amplitudes recientes)
  // Estimación simple de ruido (ej: std dev de la derivada reciente si estuviera disponible)
  // state.noiseLevelEstimate = updateNoiseEstimate(...);
  
  // Actualizar buffer de amplitudes recientes (solo valores positivos significativos)
  if (normalizedValue > state.minPeakValue * 0.5) {
      state.recentAmplitudes.push(normalizedValue);
      if (state.recentAmplitudes.length > AMPLITUDE_BUFFER_SIZE) {
          state.recentAmplitudes.shift();
      }
  }
  
  if (state.recentAmplitudes.length > ADAPTIVE_THRESHOLD_WINDOW) {
      const recentSorted = [...state.recentAmplitudes].sort((a, b) => a - b);
      // Usar un percentil (ej: 60-70%) de las amplitudes recientes como base
      const percentileIndex = Math.floor(recentSorted.length * 0.65);
      const amplitudeBase = recentSorted[percentileIndex];
      // El umbral es una fracción de la amplitud reciente + nivel de ruido estimado
      const newAdaptiveThreshold = Math.max(
          state.minPeakValue, // Nunca por debajo del mínimo absoluto
          amplitudeBase * 0.4 + state.noiseLevelEstimate // Ajustar factores
      );
      // Suavizar cambio del umbral
      state.adaptiveThreshold = state.adaptiveThreshold * 0.8 + newAdaptiveThreshold * 0.2;
  }

  // Actualizar tiempo del último pico si es candidato (se usa para MIN_PEAK_TIME_MS)
  // Nota: Esto podría permitir que un candidato no confirmado bloquee uno real.
  // Considerar actualizar solo en confirmPeak.
  // if (isPeakCandidate) { 
  //     state.lastPeakTime = currentTime;
  // }

  return { isPeakCandidate, confidence, updatedState: state };
}

/**
 * Confirma si un pico candidato es válido basado en contexto local.
 * Incluye validación de prominencia y anchura.
 */
export function confirmPeak(
  isPeakCandidate: boolean,
  normalizedValue: number,
  confidence: number,
  signalWindow: number[], // Ventana de señal normalizada alrededor del punto actual
  currentState: PeakConfirmationState,
  minConfidence: number,
  adaptiveThreshold: number
): {
  isConfirmedPeak: boolean;
  updatedState: PeakConfirmationState;
} {
  let isConfirmed = false;
  currentState.buffer.push(isPeakCandidate ? normalizedValue : -1); // Usar -1 para no-candidatos
  if (currentState.buffer.length > CONFIRMATION_WINDOW_SIZE) {
    currentState.buffer.shift();
  }

  const currentWindowIndex = Math.floor(CONFIRMATION_WINDOW_SIZE / 2);
  
  // Solo confirmar si el punto central del buffer es un candidato
  if (currentState.buffer[currentWindowIndex] > 0 && 
      confidence >= minConfidence && 
      !currentState.lastConfirmedPeak) { // Evitar confirmar inmediatamente después de otra confirmación

    // 1. Es máximo local en la ventana de confirmación?
    let isLocalMax = true;
    for (let i = 0; i < CONFIRMATION_WINDOW_SIZE; i++) {
      if (i !== currentWindowIndex && currentState.buffer[i] > currentState.buffer[currentWindowIndex]) {
        isLocalMax = false;
        break;
      }
    }

    if (isLocalMax) {
      // 2. Validar Prominencia y Anchura usando signalWindow
      const windowCenterIndex = Math.floor(signalWindow.length / 2);
      const peakValue = signalWindow[windowCenterIndex];
      
      // Encontrar valles locales a izquierda y derecha
      let leftValley = peakValue;
      let rightValley = peakValue;
      let peakWidth = 1;
      let leftIndex = windowCenterIndex - 1;
      let rightIndex = windowCenterIndex + 1;
      
      // Izquierda
      while (leftIndex >= 0) {
          if (signalWindow[leftIndex] >= signalWindow[leftIndex + 1]) break; // Ya no baja
          leftValley = Math.min(leftValley, signalWindow[leftIndex]);
          peakWidth++;
          leftIndex--;
      }
       // Derecha
      while (rightIndex < signalWindow.length) {
          if (signalWindow[rightIndex] >= signalWindow[rightIndex - 1]) break; // Ya no baja
          rightValley = Math.min(rightValley, signalWindow[rightIndex]);
           peakWidth++;
          rightIndex++;
      }

      const prominence = peakValue - Math.max(leftValley, rightValley);
      
      // Validar usando el umbral adaptativo pasado
      if (prominence >= adaptiveThreshold * MIN_PEAK_PROMINENCE_FACTOR && 
          peakWidth <= MAX_PEAK_WIDTH_SAMPLES) {
         isConfirmed = true;
      } else {
          // console.log(`Peak rejected: Prominence=${prominence.toFixed(2)}, Width=${peakWidth}`);
      }
    }
  }

  currentState.lastConfirmedPeak = isConfirmed;
  return { 
      isConfirmedPeak: isConfirmed, 
      updatedState: { ...currentState, buffer: [...currentState.buffer] } 
  };
}

/**
 * Obtiene el estado inicial para la detección de picos.
 */
export function getInitialPeakDetectionState(): PeakDetectionState {
    // Copiar el objeto por defecto para evitar mutaciones
    return JSON.parse(JSON.stringify(PEAK_STATE_DEFAULTS));
}

/**
 * Obtiene el estado inicial para la confirmación de picos.
 */
export function getInitialPeakConfirmationState(): PeakConfirmationState {
    return JSON.parse(JSON.stringify(CONFIRMATION_STATE_DEFAULTS));
}
