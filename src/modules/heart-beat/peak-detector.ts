/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { HeartBeatConfig } from './config'; // Ensure this import is present

/**
 * Functions for detecting peaks in PPG signals
 */

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

// Restaurar PEAK_STATE_DEFAULTS aquí
const PEAK_STATE_DEFAULTS: PeakDetectionState = {
  lastPeakTime: null,
  adaptiveThreshold: HeartBeatConfig.SIGNAL_THRESHOLD, 
  noiseLevelEstimate: 0.05, 
  recentAmplitudes: [],
  minPeakValue: HeartBeatConfig.SIGNAL_THRESHOLD * 0.4 
};

// Interfaz para el estado de confirmación (restaurada)
export interface PeakConfirmationState {
  buffer: number[]; // Almacena valores normalizados si son picos candidatos
  lastConfirmedPeak: boolean;
}

// Restaurar constante por defecto
const CONFIRMATION_STATE_DEFAULTS: PeakConfirmationState = {
  buffer: [],
  lastConfirmedPeak: false,
};

// Restaurar constantes de validación
const CONFIRMATION_WINDOW_SIZE = 5;
const MIN_PEAK_PROMINENCE_FACTOR = 0.4; 
const MAX_PEAK_WIDTH_SAMPLES = 8; 

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
  adaptiveThreshold: number // Usar el umbral calculado en detectPeak
): {
  isConfirmedPeak: boolean;
  updatedState: PeakConfirmationState;
} {
  let isConfirmed = false;
  // Usar una copia del estado para no mutar el original directamente aquí
  let updatedBuffer = [...currentState.buffer];
  let updatedLastConfirmed = currentState.lastConfirmedPeak;

  updatedBuffer.push(isPeakCandidate ? normalizedValue : -1); 
  if (updatedBuffer.length > CONFIRMATION_WINDOW_SIZE) {
    updatedBuffer.shift();
  }

  // Asegurar que tengamos suficientes datos en el buffer de confirmación
  if (updatedBuffer.length < CONFIRMATION_WINDOW_SIZE) {
       return { 
           isConfirmedPeak: false, 
           updatedState: { buffer: updatedBuffer, lastConfirmedPeak: false }
       };
  }

  const currentWindowIndex = Math.floor(CONFIRMATION_WINDOW_SIZE / 2);
  
  // Solo confirmar si el punto central del buffer es un candidato válido
  if (updatedBuffer[currentWindowIndex] > 0 && 
      confidence >= minConfidence && 
      !currentState.lastConfirmedPeak) { // Evitar confirmar inmediatamente después de otra confirmación

    // 1. Es máximo local en la ventana de confirmación?
    let isLocalMax = true;
    for (let i = 0; i < CONFIRMATION_WINDOW_SIZE; i++) {
      // Comparar con el valor en el buffer, no el normalizedValue actual
      if (i !== currentWindowIndex && updatedBuffer[i] > updatedBuffer[currentWindowIndex]) {
        isLocalMax = false;
        break;
      }
    }

    if (isLocalMax) {
      // 2. Validar Prominencia y Anchura usando signalWindow
      // Asegurar que signalWindow tenga longitud impar y el pico esté en el centro
      if (signalWindow && signalWindow.length % 2 === 1) { 
          const windowCenterIndex = Math.floor(signalWindow.length / 2);
          // Verificar que el índice central corresponda al pico que estamos confirmando
          // (Esta verificación puede ser compleja, asumimos que signalWindow está correctamente alineada)
          const peakValue = signalWindow[windowCenterIndex]; 
          
          let leftValley = peakValue;
          let rightValley = peakValue;
          let peakWidth = 1;
          let leftIndex = windowCenterIndex - 1;
          let rightIndex = windowCenterIndex + 1;
          
          // Izquierda
          while (leftIndex >= 0 && peakWidth < MAX_PEAK_WIDTH_SAMPLES / 2) {
              if (signalWindow[leftIndex] >= signalWindow[leftIndex + 1]) break; 
              leftValley = Math.min(leftValley, signalWindow[leftIndex]);
              peakWidth++;
              leftIndex--;
          }
          // Derecha
          while (rightIndex < signalWindow.length && peakWidth < MAX_PEAK_WIDTH_SAMPLES) {
              if (signalWindow[rightIndex] >= signalWindow[rightIndex - 1]) break; 
              rightValley = Math.min(rightValley, signalWindow[rightIndex]);
              peakWidth++;
              rightIndex++;
          }

          const prominence = peakValue - Math.max(leftValley, rightValley);
          
          // Validar
          if (prominence >= adaptiveThreshold * MIN_PEAK_PROMINENCE_FACTOR && 
              peakWidth <= MAX_PEAK_WIDTH_SAMPLES) {
             isConfirmed = true;
          } else {
              // console.log(`Peak rejected: Prominence=${prominence.toFixed(2)}, Width=${peakWidth}`);
          }
      } else {
          // Si signalWindow no es válida, usar confirmación simple basada en confianza y localMax
          isConfirmed = true; 
      }
    }
  }

  updatedLastConfirmed = isConfirmed;
  return { 
      isConfirmedPeak: isConfirmed, 
      // Devolver el estado actualizado
      updatedState: { buffer: updatedBuffer, lastConfirmedPeak: updatedLastConfirmed } 
  };
}

// Restaurar la función para obtener estado de confirmación inicial
export function getInitialPeakConfirmationState(): PeakConfirmationState {
    return JSON.parse(JSON.stringify(CONFIRMATION_STATE_DEFAULTS));
}

// Constantes para lógica
const ADAPTIVE_THRESHOLD_WINDOW = 15; 
const AMPLITUDE_BUFFER_SIZE = 20;
const REFRACTORY_PERIOD_MS = HeartBeatConfig.MIN_PEAK_TIME_MS * 0.6; 
