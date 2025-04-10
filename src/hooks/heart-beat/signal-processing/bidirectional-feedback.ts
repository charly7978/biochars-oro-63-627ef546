
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
 * Actualiza la retroalimentación de calidad de señal
 */
export function updateSignalQualityFeedback(
  currentState: FeedbackState,
  newFeedback: SignalQualityFeedback
): FeedbackState {
  return {
    ...currentState,
    signalQuality: {
      ...currentState.signalQuality,
      ...newFeedback
    }
  };
}

/**
 * Actualiza la retroalimentación de frecuencia cardíaca
 */
export function updateHeartRateFeedback(
  currentState: FeedbackState,
  newFeedback: HeartRateFeedback
): FeedbackState {
  return {
    ...currentState,
    heartRate: {
      ...currentState.heartRate,
      ...newFeedback
    }
  };
}

/**
 * Actualiza la retroalimentación de signos vitales
 */
export function updateVitalSignsFeedback(
  currentState: FeedbackState,
  newFeedback: VitalSignsFeedback
): FeedbackState {
  return {
    ...currentState,
    vitalSigns: {
      ...currentState.vitalSigns,
      ...newFeedback
    }
  };
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
 * Aplica retroalimentación bidireccional a un valor
 */
export function applyBidirectionalFeedback(
  value: number,
  weakSignalCount: number,
  feedbackState: FeedbackState,
  options: { lowSignalThreshold?: number; maxWeakSignalCount?: number }
): { isWeakSignal: boolean; updatedWeakSignalsCount: number; adjustedValue: number } {
  const LOW_SIGNAL_THRESHOLD = options.lowSignalThreshold || 0.05;
  const MAX_WEAK_SIGNALS = options.maxWeakSignalCount || 10;

  // Factor de ajuste basado en la confianza de detección de dedo
  const fingerDetectionFactor = 0.4 + (feedbackState.signalQuality.fingerDetectionConfidence * 0.6);
  
  // Factor de ajuste basado en la estabilidad de la señal
  const stabilityFactor = 0.5 + (feedbackState.signalQuality.stabilityScore * 0.5);
  
  // Ajustar el valor basado en retroalimentación
  const adjustedValue = value * fingerDetectionFactor * stabilityFactor;
  
  // Determinar si la señal es débil basado en el valor ajustado
  const isCurrentValueWeak = Math.abs(adjustedValue) < LOW_SIGNAL_THRESHOLD;
  
  // Actualizar contador de señales débiles consecutivas
  let updatedWeakSignalsCount = isCurrentValueWeak 
    ? Math.min(weakSignalCount + 1, MAX_WEAK_SIGNALS)
    : Math.max(0, weakSignalCount - 1);
  
  // La señal se considera débil si tenemos suficientes lecturas débiles consecutivas
  const isWeakSignal = updatedWeakSignalsCount >= MAX_WEAK_SIGNALS;
  
  return { isWeakSignal, updatedWeakSignalsCount, adjustedValue };
}
