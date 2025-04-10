/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Corregir importación para usar FeedbackState desde types.ts
import { FeedbackState } from './types';

import { 
  applyBidirectionalFeedback, 
  createInitialFeedbackState 
} from './bidirectional-feedback';

interface SignalQualityOptions {
  lowSignalThreshold?: number;
  maxWeakSignalCount?: number;
  feedbackState?: FeedbackState;
}

// Global feedback state for cross-component communication
let globalFeedbackState: FeedbackState = createInitialFeedbackState();

/**
 * Gets the current global feedback state
 */
export function getGlobalFeedbackState(): FeedbackState {
  return globalFeedbackState;
}

/**
 * Updates the global feedback state
 */
export function updateGlobalFeedbackState(newState: FeedbackState): void {
  globalFeedbackState = newState;
  
  // Añadir logs detallados para probar que los cambios realmente ocurren
  console.log("Sistema de retroalimentación actualizado:", {
    timestamp: new Date().toISOString(),
    señal: {
      intensidad: (newState.signalQuality.signalStrength * 100).toFixed(2) + '%',
      detecciónDedo: (newState.signalQuality.fingerDetectionConfidence * 100).toFixed(2) + '%'
    },
    ritmoCardíaco: {
      bpm: newState.heartRate.currentBPM,
      confianza: (newState.heartRate.confidence * 100).toFixed(2) + '%',
      pico: newState.heartRate.isPeak ? 'ACTIVO' : 'inactivo'
    },
    análisis: {
      oxígeno: (newState.vitalSigns.spo2Quality * 100).toFixed(2) + '%',
      glucosa: newState.vitalSigns.glucoseReliability 
        ? (newState.vitalSigns.glucoseReliability * 100).toFixed(2) + '%'
        : 'no disponible',
      lípidos: newState.vitalSigns.lipidsReliability
        ? (newState.vitalSigns.lipidsReliability * 100).toFixed(2) + '%'
        : 'no disponible'
    }
  });
}

/**
 * Verifica si una señal es débil basándose en umbrales configurables
 * Enhanced with bidirectional feedback system
 */
export function checkWeakSignal(
  value: number,
  currentWeakSignalCount: number,
  options: SignalQualityOptions = {}
): { isWeakSignal: boolean; updatedWeakSignalsCount: number; adjustedValue: number } {
  // Use bidirectional feedback if provided, otherwise use global state
  const feedbackState = options.feedbackState || globalFeedbackState;
  
  return applyBidirectionalFeedback(
    value, 
    currentWeakSignalCount, 
    feedbackState, 
    {
      lowSignalThreshold: options.lowSignalThreshold,
      maxWeakSignalCount: options.maxWeakSignalCount
    }
  );
}

/**
 * Verifica si se debe procesar una medición según la intensidad de la señal
 * Enhanced with adjusted value from feedback system
 */
export function shouldProcessMeasurement(
  value: number,
  weakSignalsCount: number = 0,
  options: SignalQualityOptions = {}
): { shouldProcess: boolean; adjustedValue: number } {
  const { isWeakSignal, adjustedValue } = checkWeakSignal(value, weakSignalsCount, options);
  return { shouldProcess: !isWeakSignal, adjustedValue };
}

/**
 * Crea un resultado vacío para señales débiles
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCounter,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
}

/**
 * Restablece el estado de detección de señal
 */
export function resetSignalQualityState(): number {
  // Reset the global feedback state
  globalFeedbackState = createInitialFeedbackState();
  return 0; // Reset the weak signals counter
}
