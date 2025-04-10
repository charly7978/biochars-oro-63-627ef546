
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Corregir importación para usar FeedbackState desde types.ts
import { FeedbackState } from './types';
import { 
  createInitialFeedbackState, 
  updateSignalQualityFeedback,
  applyBidirectionalFeedback 
} from './bidirectional-feedback';

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
 * Verifica si una señal es débil utilizando retroalimentación bidireccional
 */
export function checkWeakSignal(
  value: number,
  currentWeakSignalCount: number,
  options: SignalQualityOptions = {}
): { 
  isWeakSignal: boolean; 
  updatedWeakSignalsCount: number; 
  adjustedValue: number;
} {
  try {
    // Obtener estado actual de feedback
    const feedbackState = getGlobalFeedbackState();
    
    // Aplicar retroalimentación bidireccional
    return applyBidirectionalFeedback(
      value,
      currentWeakSignalCount,
      feedbackState,
      {
        lowSignalThreshold: options.lowSignalThreshold,
        maxWeakSignalCount: options.maxWeakSignalCount
      }
    );
  } catch (error) {
    console.error('Error verificando señal débil:', error);
    return {
      isWeakSignal: false,
      updatedWeakSignalsCount: currentWeakSignalCount,
      adjustedValue: value
    };
  }
}

/**
 * Determina si se debe procesar una medición basado en la calidad de la señal
 */
export function shouldProcessMeasurement(
  value: number,
  weakSignalsCount: number = 0,
  options: SignalQualityOptions = {}
): { 
  shouldProcess: boolean; 
  adjustedValue: number;
} {
  try {
    // Verificar señal débil con feedback
    const { isWeakSignal, adjustedValue } = checkWeakSignal(
      value,
      weakSignalsCount,
      options
    );

    // Obtener estado de feedback
    const feedbackState = getGlobalFeedbackState();
    
    // Determinar si procesar basado en múltiples factores
    const shouldProcess = !isWeakSignal && 
      feedbackState.signalQuality.signalStrength > 0.3 &&
      feedbackState.signalQuality.fingerDetectionConfidence > 0.4;

    return {
      shouldProcess,
      adjustedValue
    };
  } catch (error) {
    console.error('Error evaluando procesamiento:', error);
    return {
      shouldProcess: false,
      adjustedValue: value
    };
  }
}

/**
 * Crea un resultado para señal débil
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
  try {
    // Obtener estado de feedback
    const feedbackState = getGlobalFeedbackState();
    
    // Actualizar feedback con señal débil
    const updatedFeedback = updateSignalQualityFeedback(
      feedbackState,
      {
        signalStrength: 0.1,
        noiseLevel: 0.9,
        stabilityScore: 0.1,
        fingerDetectionConfidence: 0.1
      }
    );
    
    // Actualizar estado global
    updateGlobalFeedbackState(updatedFeedback);
    
    return {
      bpm: 0,
      confidence: 0,
      isPeak: false,
      arrhythmiaCount: arrhythmiaCounter
    };
  } catch (error) {
    console.error('Error creando resultado de señal débil:', error);
    return {
      bpm: 0,
      confidence: 0,
      isPeak: false,
      arrhythmiaCount: arrhythmiaCounter
    };
  }
}

/**
 * Reinicia el estado de calidad de señal
 */
export function resetSignalQualityState(): number {
  try {
    // Reiniciar estado de feedback
    updateGlobalFeedbackState(createInitialFeedbackState());
    return 0;
  } catch (error) {
    console.error('Error reiniciando estado de calidad:', error);
    return 0;
  }
}
