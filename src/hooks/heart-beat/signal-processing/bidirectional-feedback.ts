/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Bidirectional Feedback System
 * Connects signal processing components for improved measurement accuracy
 */

// Signal quality feedback types
export type SignalQualityFeedback = {
  signalStrength: number;
  noiseLevel: number;
  stabilityScore: number;
  fingerDetectionConfidence: number;
};

// Heart rate feedback types
export type HeartRateFeedback = {
  currentBPM: number;
  confidence: number;
  peakStrength: number;
  rhythmStability: number;
  isPeak: boolean;
};

// Vital signs feedback types
export type VitalSignsFeedback = {
  spo2Quality: number;
  pressureReliability: number;
  arrhythmiaConfidence: number;
};

// Bidirectional feedback state
export interface FeedbackState {
  signalQuality: SignalQualityFeedback;
  heartRate: HeartRateFeedback;
  vitalSigns: VitalSignsFeedback;
  lastUpdateTime: number;
}

/**
 * Creates a new feedback state with default values
 */
export function createInitialFeedbackState(): FeedbackState {
  const initialState = {
    signalQuality: {
      signalStrength: 0.1, // Small initial value for visualization
      noiseLevel: 0.1,     // Small initial value for visualization
      stabilityScore: 0.1, // Small initial value for visualization
      fingerDetectionConfidence: 0.1
    },
    heartRate: {
      currentBPM: 0,
      confidence: 0.1,     // Small initial value for visualization
      peakStrength: 0.1,   // Small initial value for visualization
      rhythmStability: 0.1, // Small initial value for visualization
      isPeak: false
    },
    vitalSigns: {
      spo2Quality: 0.1,    // Small initial value for visualization
      pressureReliability: 0.1, // Small initial value for visualization
      arrhythmiaConfidence: 0.1 // Small initial value for visualization
    },
    lastUpdateTime: Date.now()
  };
  
  console.log("Initial feedback state created:", initialState);
  return initialState;
}

/**
 * Updates signal quality feedback and adjusts system parameters based on other components
 */
export function updateSignalQualityFeedback(
  currentState: FeedbackState,
  newData: Partial<SignalQualityFeedback>,
  heartRateData?: Partial<HeartRateFeedback>
): FeedbackState {
  const now = Date.now();
  
  // Calculate adaptive thresholds based on heart rate stability
  let adaptiveNoiseThreshold = 0.05;
  let adaptiveStabilityThreshold = 0.6;
  
  if (heartRateData && heartRateData.rhythmStability > 0) {
    // Adjust thresholds based on heart rate stability
    adaptiveNoiseThreshold *= (1 + (1 - heartRateData.rhythmStability) * 0.5);
    adaptiveStabilityThreshold *= (1 - (1 - heartRateData.rhythmStability) * 0.2);
  }
  
  // Adjust finger detection confidence based on signal strength and stability
  let adjustedFingerConfidence = newData.fingerDetectionConfidence || 
                                currentState.signalQuality.fingerDetectionConfidence;
  
  if (newData.signalStrength !== undefined && newData.stabilityScore !== undefined) {
    // Reduce confidence if signal is weak or unstable
    if (newData.signalStrength < 0.3 || newData.stabilityScore < adaptiveStabilityThreshold) {
      adjustedFingerConfidence *= 0.9;
    }
  }
  
  return {
    ...currentState,
    signalQuality: {
      ...currentState.signalQuality,
      ...newData,
      fingerDetectionConfidence: adjustedFingerConfidence
    },
    lastUpdateTime: now
  };
}

/**
 * Updates heart rate feedback and adjusts parameters based on signal quality
 */
export function updateHeartRateFeedback(
  currentState: FeedbackState,
  newData: Partial<HeartRateFeedback>,
  signalQualityData?: Partial<SignalQualityFeedback>
): FeedbackState {
  const now = Date.now();
  
  // Calculate confidence adjustment based on signal quality
  let confidenceAdjustment = 1.0;
  
  if (signalQualityData) {
    const signalStrength = signalQualityData.signalStrength || 
                          currentState.signalQuality.signalStrength;
    
    const noiseLevel = signalQualityData.noiseLevel || 
                      currentState.signalQuality.noiseLevel;
    
    // Reduce confidence when signal quality is poor
    if (signalStrength < 0.4) {
      confidenceAdjustment *= (0.5 + signalStrength);
    }
    
    if (noiseLevel > 0.3) {
      confidenceAdjustment *= (1 - noiseLevel * 0.5);
    }
  }
  
  // Adjust confidence using the calculated factor
  let adjustedConfidence = newData.confidence !== undefined
    ? newData.confidence * confidenceAdjustment
    : currentState.heartRate.confidence;
  
  // Cap to valid range
  adjustedConfidence = Math.max(0, Math.min(1, adjustedConfidence));
  
  return {
    ...currentState,
    heartRate: {
      ...currentState.heartRate,
      ...newData,
      confidence: adjustedConfidence
    },
    lastUpdateTime: now
  };
}

/**
 * Updates vital signs feedback based on heart rate stability and signal quality
 */
export function updateVitalSignsFeedback(
  currentState: FeedbackState,
  newData: Partial<VitalSignsFeedback>,
  heartRateData?: Partial<HeartRateFeedback>,
  signalQualityData?: Partial<SignalQualityFeedback>
): FeedbackState {
  const now = Date.now();
  
  // Calculate composite quality score from heart rate and signal quality
  let compositeQualityScore = 1.0;
  
  if (heartRateData && heartRateData.confidence !== undefined) {
    compositeQualityScore *= (0.7 + heartRateData.confidence * 0.3);
  }
  
  if (signalQualityData) {
    const signalStrength = signalQualityData.signalStrength || 
                          currentState.signalQuality.signalStrength;
                          
    if (signalStrength < 0.5) {
      compositeQualityScore *= (0.6 + signalStrength * 0.8);
    }
  }
  
  // Adjust vital signs reliability based on composite score
  const adjustedSpo2Quality = newData.spo2Quality !== undefined
    ? newData.spo2Quality * compositeQualityScore
    : currentState.vitalSigns.spo2Quality;
    
  const adjustedPressureReliability = newData.pressureReliability !== undefined
    ? newData.pressureReliability * compositeQualityScore
    : currentState.vitalSigns.pressureReliability;
  
  // Arrhythmia confidence adjustment should be more sensitive to heart rate stability
  let arrhythmiaConfidenceAdjustment = compositeQualityScore;
  if (heartRateData && heartRateData.rhythmStability !== undefined) {
    // Higher rhythm stability should increase arrhythmia detection confidence
    arrhythmiaConfidenceAdjustment *= (0.5 + heartRateData.rhythmStability * 0.5);
  }
  
  const adjustedArrhythmiaConfidence = newData.arrhythmiaConfidence !== undefined
    ? newData.arrhythmiaConfidence * arrhythmiaConfidenceAdjustment
    : currentState.vitalSigns.arrhythmiaConfidence;
  
  const updatedState = {
    ...currentState,
    vitalSigns: {
      ...currentState.vitalSigns,
      spo2Quality: adjustedSpo2Quality,
      pressureReliability: adjustedPressureReliability,
      arrhythmiaConfidence: adjustedArrhythmiaConfidence
    },
    lastUpdateTime: now
  };
  
  // Add more debug logging
  console.log("Updated vital signs feedback:", {
    oldValues: currentState.vitalSigns,
    newValues: updatedState.vitalSigns,
    updateTime: new Date(now).toISOString()
  });
  
  return updatedState;
}

/**
 * Applies bidirectional feedback to improve weak signal detection
 */
export function applyBidirectionalFeedback(
  value: number,
  currentWeakSignalCount: number,
  feedbackState: FeedbackState,
  options: {
    lowSignalThreshold?: number;
    maxWeakSignalCount?: number;
    heartRateConfidenceThreshold?: number;
  } = {}
): { isWeakSignal: boolean; updatedWeakSignalsCount: number; adjustedValue: number } {
  // Default thresholds with adaptive adjustment
  const LOW_SIGNAL_THRESHOLD = options.lowSignalThreshold || 0.05;
  const MAX_WEAK_SIGNALS = options.maxWeakSignalCount || 10;
  const HEART_RATE_CONFIDENCE_THRESHOLD = options.heartRateConfidenceThreshold || 0.4;
  
  // Apply bidirectional adjustment from heart rate feedback
  let adjustedThreshold = LOW_SIGNAL_THRESHOLD;
  let adjustedValue = value;
  
  // If heart rate is detected with good confidence, be more lenient with signal threshold
  if (feedbackState.heartRate.confidence > HEART_RATE_CONFIDENCE_THRESHOLD) {
    adjustedThreshold *= 0.9;
    
    // Apply subtle signal boosting if we have heart rate feedback
    if (Math.abs(value) > 0 && feedbackState.heartRate.currentBPM > 40) {
      const boostFactor = Math.min(feedbackState.heartRate.confidence * 0.2, 0.15);
      adjustedValue = value * (1 + boostFactor);
    }
  }
  
  // Apply threshold adjustment based on signal quality feedback
  if (feedbackState.signalQuality.stabilityScore > 0.7) {
    adjustedThreshold *= 0.95; // Be more lenient with stable signals
  }
  
  // Check if the current value is weak using adjusted threshold
  const isCurrentValueWeak = Math.abs(adjustedValue) < adjustedThreshold;
  
  // Update consecutive weak signals counter
  let updatedWeakSignalsCount = isCurrentValueWeak 
    ? currentWeakSignalCount + 1 
    : Math.max(0, currentWeakSignalCount - 1); // Gradual reduction
  
  // Apply counter adjustment based on finger detection confidence
  if (feedbackState.signalQuality.fingerDetectionConfidence > 0.8 && updatedWeakSignalsCount > 0) {
    updatedWeakSignalsCount = Math.max(0, updatedWeakSignalsCount - 1);
  }
  
  // Limit to max
  updatedWeakSignalsCount = Math.min(MAX_WEAK_SIGNALS, updatedWeakSignalsCount);
  
  // Signal is considered weak if we have enough consecutive weak readings
  const isWeakSignal = updatedWeakSignalsCount >= MAX_WEAK_SIGNALS;
  
  return { 
    isWeakSignal, 
    updatedWeakSignalsCount,
    adjustedValue
  };
}

/**
 * Log feedback state for debugging
 */
export function logFeedbackState(state: FeedbackState, source: string): void {
  console.log(`Bidirectional Feedback (${source}):`, {
    signalQuality: {
      strength: state.signalQuality.signalStrength.toFixed(2),
      noise: state.signalQuality.noiseLevel.toFixed(2),
      stability: state.signalQuality.stabilityScore.toFixed(2),
      fingerConfidence: state.signalQuality.fingerDetectionConfidence.toFixed(2)
    },
    heartRate: {
      bpm: state.heartRate.currentBPM,
      confidence: state.heartRate.confidence.toFixed(2),
      stability: state.heartRate.rhythmStability.toFixed(2),
      isPeak: state.heartRate.isPeak
    },
    vitalSigns: {
      spo2Quality: state.vitalSigns.spo2Quality.toFixed(2),
      pressureReliability: state.vitalSigns.pressureReliability.toFixed(2),
      arrhythmiaConfidence: state.vitalSigns.arrhythmiaConfidence.toFixed(2)
    },
    lastUpdate: new Date(state.lastUpdateTime).toISOString()
  });
}
