
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
  // Log update to verify real changes
  console.log("Signal Quality Feedback Update:", {
    before: {
      signalStrength: (currentState.signalQuality.signalStrength * 100).toFixed(1) + "%",
      noiseLevel: (currentState.signalQuality.noiseLevel * 100).toFixed(1) + "%",
      stability: (currentState.signalQuality.stabilityScore * 100).toFixed(1) + "%",
      fingerDetection: (currentState.signalQuality.fingerDetectionConfidence * 100).toFixed(1) + "%"
    },
    after: {
      signalStrength: (newFeedback.signalStrength * 100).toFixed(1) + "%",
      noiseLevel: (newFeedback.noiseLevel * 100).toFixed(1) + "%",
      stability: (newFeedback.stabilityScore * 100).toFixed(1) + "%",
      fingerDetection: (newFeedback.fingerDetectionConfidence * 100).toFixed(1) + "%"
    },
    timestamp: new Date().toISOString()
  });
  
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
  // Log update to verify real changes
  console.log("Heart Rate Feedback Update:", {
    before: {
      bpm: currentState.heartRate.currentBPM,
      confidence: (currentState.heartRate.confidence * 100).toFixed(1) + "%",
      peakStrength: (currentState.heartRate.peakStrength * 100).toFixed(1) + "%",
      stability: (currentState.heartRate.rhythmStability * 100).toFixed(1) + "%",
      isPeak: currentState.heartRate.isPeak ? "YES" : "NO"
    },
    after: {
      bpm: newFeedback.currentBPM,
      confidence: (newFeedback.confidence * 100).toFixed(1) + "%",
      peakStrength: (newFeedback.peakStrength * 100).toFixed(1) + "%",
      stability: (newFeedback.rhythmStability * 100).toFixed(1) + "%",
      isPeak: newFeedback.isPeak ? "YES" : "NO"
    },
    timestamp: new Date().toISOString()
  });
  
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
  // Log update to verify real changes
  console.log("Vital Signs Feedback Update:", {
    before: {
      spo2: (currentState.vitalSigns.spo2Quality * 100).toFixed(1) + "%",
      pressure: (currentState.vitalSigns.pressureReliability * 100).toFixed(1) + "%",
      arrhythmia: (currentState.vitalSigns.arrhythmiaConfidence * 100).toFixed(1) + "%",
      glucose: currentState.vitalSigns.glucoseReliability 
        ? (currentState.vitalSigns.glucoseReliability * 100).toFixed(1) + "%" 
        : "N/A",
      lipids: currentState.vitalSigns.lipidsReliability
        ? (currentState.vitalSigns.lipidsReliability * 100).toFixed(1) + "%"
        : "N/A"
    },
    after: {
      spo2: (newFeedback.spo2Quality * 100).toFixed(1) + "%",
      pressure: (newFeedback.pressureReliability * 100).toFixed(1) + "%",
      arrhythmia: (newFeedback.arrhythmiaConfidence * 100).toFixed(1) + "%",
      glucose: newFeedback.glucoseReliability
        ? (newFeedback.glucoseReliability * 100).toFixed(1) + "%"
        : "N/A",
      lipids: newFeedback.lipidsReliability
        ? (newFeedback.lipidsReliability * 100).toFixed(1) + "%"
        : "N/A"
    },
    timestamp: new Date().toISOString()
  });
  
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
  console.log(`[${source}] Feedback state at ${new Date().toISOString()}:`, {
    signalQuality: {
      signalStrength: (state.signalQuality.signalStrength * 100).toFixed(1) + '%',
      noiseLevel: (state.signalQuality.noiseLevel * 100).toFixed(1) + '%',
      stability: (state.signalQuality.stabilityScore * 100).toFixed(1) + '%',
      fingerDetection: (state.signalQuality.fingerDetectionConfidence * 100).toFixed(1) + '%'
    },
    heartRate: {
      bpm: state.heartRate.currentBPM,
      confidence: (state.heartRate.confidence * 100).toFixed(1) + '%',
      rhythmStability: (state.heartRate.rhythmStability * 100).toFixed(1) + '%',
      isPeak: state.heartRate.isPeak
    },
    vitalSigns: {
      spo2: (state.vitalSigns.spo2Quality * 100).toFixed(1) + '%',
      pressure: (state.vitalSigns.pressureReliability * 100).toFixed(1) + '%',
      arrhythmia: (state.vitalSigns.arrhythmiaConfidence * 100).toFixed(1) + '%',
      glucose: state.vitalSigns.glucoseReliability 
        ? (state.vitalSigns.glucoseReliability * 100).toFixed(1) + '%' 
        : 'N/A',
      lipids: state.vitalSigns.lipidsReliability 
        ? (state.vitalSigns.lipidsReliability * 100).toFixed(1) + '%' 
        : 'N/A'
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
  // Default thresholds
  const LOW_SIGNAL_THRESHOLD = options.lowSignalThreshold || 0.05;
  const MAX_WEAK_SIGNALS = options.maxWeakSignalCount || 10;
  
  // Adjust threshold based on finger detection confidence
  const adjustedThreshold = LOW_SIGNAL_THRESHOLD * 
    (1 - (feedbackState.signalQuality.fingerDetectionConfidence * 0.5));
  
  const isCurrentValueWeak = Math.abs(value) < adjustedThreshold;
  
  // Update consecutive weak signals counter with feedback influence
  let updatedWeakSignalsCount = isCurrentValueWeak 
    ? weakSignalCount + 1 
    : Math.max(0, weakSignalCount - 1);
  
  // Limit to max
  updatedWeakSignalsCount = Math.min(MAX_WEAK_SIGNALS, updatedWeakSignalsCount);
  
  // Signal is considered weak if we have enough consecutive weak readings
  // Factor in signal quality feedback
  const qualityAdjustment = 1 - (feedbackState.signalQuality.signalStrength * 0.3);
  const adjustedMaxWeak = Math.floor(MAX_WEAK_SIGNALS * qualityAdjustment);
  
  const isWeakSignal = updatedWeakSignalsCount >= adjustedMaxWeak;
  
  // Adjust value based on feedback state
  let adjustedValue = value;
  
  // If we have good heart rate confidence, slightly boost the signal
  if (feedbackState.heartRate.confidence > 0.3) {
    const boostFactor = 1 + (feedbackState.heartRate.confidence * 0.3);
    adjustedValue *= boostFactor;
  }
  
  // Log actual values for debugging
  console.log("Bidirectional feedback applied:", {
    originalValue: value,
    adjustedValue: adjustedValue,
    originalThreshold: LOW_SIGNAL_THRESHOLD,
    adjustedThreshold: adjustedThreshold,
    weakSignalsCount: weakSignalCount,
    updatedWeakSignalsCount: updatedWeakSignalsCount,
    isWeakSignal: isWeakSignal,
    fingerDetectionConfidence: feedbackState.signalQuality.fingerDetectionConfidence,
    heartRateConfidence: feedbackState.heartRate.confidence,
    timestamp: new Date().toISOString()
  });
  
  return { isWeakSignal, updatedWeakSignalsCount, adjustedValue };
}
