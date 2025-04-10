
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Corregir importación para usar FeedbackState desde types.ts
import { FeedbackState } from './types';

import { createInitialFeedbackState } from './bidirectional-feedback';

interface SignalQualityOptions {
  lowSignalThreshold?: number;
  maxWeakSignalCount?: number;
  feedbackState?: FeedbackState;
}

// Basic feedback state for internal use
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
}

/**
 * Verifica si una señal es débil basándose en umbrales configurables
 * Simplified version without feedback system
 */
export function checkWeakSignal(
  value: number,
  currentWeakSignalCount: number,
  options: SignalQualityOptions = {}
): { isWeakSignal: boolean; updatedWeakSignalsCount: number; adjustedValue: number } {
  const lowSignalThreshold = options.lowSignalThreshold || 0.02;
  const maxWeakSignalCount = options.maxWeakSignalCount || 5;
  
  // Determine if signal is too weak
  const isWeakSignal = Math.abs(value) < lowSignalThreshold;
  
  // Update weak signal counter
  const updatedWeakSignalsCount = isWeakSignal
    ? Math.min(currentWeakSignalCount + 1, maxWeakSignalCount)
    : Math.max(currentWeakSignalCount - 1, 0);
  
  return {
    isWeakSignal: updatedWeakSignalsCount >= maxWeakSignalCount,
    updatedWeakSignalsCount,
    adjustedValue: value
  };
}

/**
 * Verifica si se debe procesar una medición según la intensidad de la señal
 * Simplified version
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
