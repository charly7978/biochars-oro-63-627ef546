import { FeedbackState } from './types';

/**
 * Crea un estado inicial de retroalimentación
 */
export function createInitialFeedbackState(): FeedbackState {
  return {
    signalQuality: {
      signalStrength: 0.1,
      noiseLevel: 0.1,
      stabilityScore: 0.1,
      fingerDetectionConfidence: 0.1
    },
    heartRate: {
      currentBPM: 0,
      confidence: 0.1,
      peakStrength: 0.1,
      rhythmStability: 0.1,
      isPeak: false
    },
    vitalSigns: {
      spo2Quality: 0.1,
      pressureReliability: 0.1,
      arrhythmiaConfidence: 0.1,
      glucoseReliability: 0.1,
      lipidsReliability: 0.1
    }
  };
}

export interface SignalQualityFeedback {
  signalStrength: number;
  noiseLevel: number;
  stabilityScore: number;
  fingerDetectionConfidence: number;
}

export interface HeartRateFeedback {
  currentBPM: number;
  confidence: number;
  peakStrength: number;
  rhythmStability: number;
  isPeak?: boolean;
}

export interface VitalSignsFeedback {
  spo2Quality: number;
  pressureReliability: number;
  arrhythmiaConfidence: number;
  glucoseReliability?: number;
  lipidsReliability?: number;
}

/**
 * Actualiza el estado de retroalimentación de calidad de señal
 */
export function updateSignalQualityFeedback(
  currentState: FeedbackState,
  newFeedback: SignalQualityFeedback
): FeedbackState {
  try {
    // Validar entradas
    if (!newFeedback || typeof newFeedback.signalStrength !== 'number') {
      console.warn('Feedback inválido para calidad de señal');
      return currentState;
    }

    // Aplicar suavizado exponencial para cambios graduales
    const alpha = 0.3; // Factor de suavizado
    
    const updatedQuality = {
      signalStrength: exponentialSmoothing(
        currentState.signalQuality.signalStrength,
        newFeedback.signalStrength,
        alpha
      ),
      noiseLevel: exponentialSmoothing(
        currentState.signalQuality.noiseLevel,
        newFeedback.noiseLevel,
        alpha
      ),
      stabilityScore: exponentialSmoothing(
        currentState.signalQuality.stabilityScore,
        newFeedback.stabilityScore,
        alpha
      ),
      fingerDetectionConfidence: exponentialSmoothing(
        currentState.signalQuality.fingerDetectionConfidence,
        newFeedback.fingerDetectionConfidence,
        alpha
      )
    };

    return {
      ...currentState,
      signalQuality: updatedQuality
    };
  } catch (error) {
    console.error('Error actualizando feedback de calidad:', error);
    return currentState;
  }
}

/**
 * Actualiza el estado de retroalimentación de frecuencia cardíaca
 */
export function updateHeartRateFeedback(
  currentState: FeedbackState,
  newFeedback: HeartRateFeedback
): FeedbackState {
  try {
    // Validar entradas
    if (!newFeedback || typeof newFeedback.currentBPM !== 'number') {
      console.warn('Feedback inválido para frecuencia cardíaca');
      return currentState;
    }

    // Aplicar suavizado exponencial
    const alpha = 0.4; // Mayor peso a valores nuevos para HR
    
    const updatedHeartRate = {
      currentBPM: newFeedback.currentBPM, // No suavizar BPM
      confidence: exponentialSmoothing(
        currentState.heartRate.confidence,
        newFeedback.confidence,
        alpha
      ),
      peakStrength: exponentialSmoothing(
        currentState.heartRate.peakStrength,
        newFeedback.peakStrength,
        alpha
      ),
      rhythmStability: exponentialSmoothing(
        currentState.heartRate.rhythmStability,
        newFeedback.rhythmStability,
        alpha
      ),
      isPeak: newFeedback.isPeak || false
    };

    return {
      ...currentState,
      heartRate: updatedHeartRate
    };
  } catch (error) {
    console.error('Error actualizando feedback de HR:', error);
    return currentState;
  }
}

/**
 * Actualiza el estado de retroalimentación de signos vitales
 */
export function updateVitalSignsFeedback(
  currentState: FeedbackState,
  newFeedback: VitalSignsFeedback
): FeedbackState {
  try {
    // Validar entradas
    if (!newFeedback) {
      console.warn('Feedback inválido para signos vitales');
      return currentState;
    }

    // Aplicar suavizado exponencial
    const alpha = 0.25; // Cambios más graduales para signos vitales
    
    const updatedVitalSigns = {
      spo2Quality: exponentialSmoothing(
        currentState.vitalSigns.spo2Quality,
        newFeedback.spo2Quality,
        alpha
      ),
      pressureReliability: exponentialSmoothing(
        currentState.vitalSigns.pressureReliability,
        newFeedback.pressureReliability,
        alpha
      ),
      arrhythmiaConfidence: exponentialSmoothing(
        currentState.vitalSigns.arrhythmiaConfidence,
        newFeedback.arrhythmiaConfidence,
        alpha
      ),
      glucoseReliability: newFeedback.glucoseReliability !== undefined
        ? exponentialSmoothing(
            currentState.vitalSigns.glucoseReliability || 0,
            newFeedback.glucoseReliability,
            alpha
          )
        : currentState.vitalSigns.glucoseReliability,
      lipidsReliability: newFeedback.lipidsReliability !== undefined
        ? exponentialSmoothing(
            currentState.vitalSigns.lipidsReliability || 0,
            newFeedback.lipidsReliability,
            alpha
          )
        : currentState.vitalSigns.lipidsReliability
    };

    return {
      ...currentState,
      vitalSigns: updatedVitalSigns
    };
  } catch (error) {
    console.error('Error actualizando feedback de vitales:', error);
    return currentState;
  }
}

/**
 * Aplica suavizado exponencial a un valor
 */
function exponentialSmoothing(currentValue: number, newValue: number, alpha: number): number {
  if (typeof currentValue !== 'number' || typeof newValue !== 'number') {
    return currentValue || 0;
  }
  return alpha * newValue + (1 - alpha) * currentValue;
}

/**
 * Logs the current feedback state for debugging
 */
export function logFeedbackState(state: FeedbackState, source: string): void {
  console.log(`[${source}] Feedback state:`, {
    signalQuality: {
      signalStrength: (state.signalQuality.signalStrength * 100).toFixed(1) + '%',
      noiseLevel: (state.signalQuality.noiseLevel * 100).toFixed(1) + '%',
      stability: (state.signalQuality.stabilityScore * 100).toFixed(1) + '%',
      fingerDetection: (state.signalQuality.fingerDetectionConfidence * 100).toFixed(1) + '%'
    },
    heartRate: {
      bpm: state.heartRate.currentBPM,
      confidence: (state.heartRate.confidence * 100).toFixed(1) + '%',
      rhythmStability: (state.heartRate.rhythmStability * 100).toFixed(1) + '%'
    },
    vitalSigns: {
      spo2: (state.vitalSigns.spo2Quality * 100).toFixed(1) + '%',
      pressure: (state.vitalSigns.pressureReliability * 100).toFixed(1) + '%',
      arrhythmia: (state.vitalSigns.arrhythmiaConfidence * 100).toFixed(1) + '%',
      glucose: (state.vitalSigns.glucoseReliability || 0) * 100 + '%',
      lipids: (state.vitalSigns.lipidsReliability || 0) * 100 + '%'
    }
  });
}

/**
 * Aplica retroalimentación bidireccional al valor de señal
 */
export function applyBidirectionalFeedback(
  value: number,
  weakSignalCount: number,
  feedbackState: FeedbackState,
  options: { 
    lowSignalThreshold?: number; 
    maxWeakSignalCount?: number;
  } = {}
): { 
  isWeakSignal: boolean; 
  updatedWeakSignalsCount: number; 
  adjustedValue: number;
} {
  try {
    const threshold = options.lowSignalThreshold || 0.15;
    const maxCount = options.maxWeakSignalCount || 5;

    // Ajustar umbral basado en calidad de señal
    const dynamicThreshold = threshold * (1 + (1 - feedbackState.signalQuality.signalStrength));

    // Detectar señal débil
    const isCurrentValueWeak = Math.abs(value) < dynamicThreshold;
    const updatedWeakSignalsCount = isCurrentValueWeak 
      ? Math.min(weakSignalCount + 1, maxCount)
      : 0;

    // Determinar si la señal es débil
    const isWeakSignal = updatedWeakSignalsCount >= maxCount;

    // Ajustar valor basado en feedback
    let adjustedValue = value;
    if (!isWeakSignal && feedbackState.signalQuality.signalStrength > 0.3) {
      // Aplicar ganancia adaptativa
      const gain = 1 + (1 - feedbackState.signalQuality.noiseLevel) * 0.5;
      adjustedValue *= gain;
    }

    return {
      isWeakSignal,
      updatedWeakSignalsCount,
      adjustedValue
    };
  } catch (error) {
    console.error('Error en retroalimentación bidireccional:', error);
    return {
      isWeakSignal: false,
      updatedWeakSignalsCount: weakSignalCount,
      adjustedValue: value
    };
  }
}

// Exportar getGlobalFeedbackState
export { getGlobalFeedbackState };
