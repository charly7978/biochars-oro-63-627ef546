
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Functions for peak detection logic, working with real data only
 */

import { getGlobalFeedbackState, updateGlobalFeedbackState } from './signal-quality';
import { updateHeartRateFeedback } from './bidirectional-feedback';

/**
 * Determines if a measurement should be processed based on signal strength
 * Enhanced with feedback system integration
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Get current feedback state
  const feedbackState = getGlobalFeedbackState();
  
  // Adjust threshold based on heart rate confidence
  let threshold = 0.008; // Base threshold
  
  if (feedbackState.heartRate.confidence > 0.4) {
    // Lower threshold if we have good heart rate confidence
    threshold *= (1 - feedbackState.heartRate.confidence * 0.3);
  }
  
  // Boost threshold if finger detection confidence is low
  if (feedbackState.signalQuality.fingerDetectionConfidence < 0.3) {
    threshold *= 1.2;
  }
  
  return Math.abs(value) >= threshold;
}

/**
 * Creates default signal processing result when signal is too weak
 * Contains only real data structure with zero values
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCounter || 0,
    rrData: {
      intervals: [],
      lastPeakTime: null
    },
    isArrhythmia: false,
    // Adding transition state to ensure continuous color rendering
    transition: {
      active: false,
      progress: 0,
      direction: 'none'
    }
  };
}

/**
 * Handle peak detection with improved natural synchronization
 * Enhanced with bidirectional feedback
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // Get current feedback state
  const feedbackState = getGlobalFeedbackState();
  
  // Only update time of peak for timing calculations
  if (result.isPeak && result.confidence > 0.05) {
    // Update peak time for time calculations only
    lastPeakTimeRef.current = now;
    
    // Update heart rate feedback in the bidirectional system
    const updatedFeedback = updateHeartRateFeedback(
      feedbackState,
      {
        currentBPM: result.bpm || feedbackState.heartRate.currentBPM,
        confidence: result.confidence,
        peakStrength: Math.abs(value),
        rhythmStability: result.rhythmVariability ? 1 - result.rhythmVariability : feedbackState.heartRate.rhythmStability,
        isPeak: true
      }
    );
    
    // Update global feedback state
    updateGlobalFeedbackState(updatedFeedback);
    
    // BEEP IS ONLY HANDLED IN PPGSignalMeter WHEN DRAWING A CIRCLE
    console.log("Peak-detection: Peak detected WITHOUT requesting beep - exclusive control by PPGSignalMeter", {
      confidence: result.confidence,
      value: value,
      time: new Date(now).toISOString(),
      // Log transition state if present
      transition: result.transition ? {
        active: result.transition.active,
        progress: result.transition.progress,
        direction: result.transition.direction
      } : 'no transition',
      isArrhythmia: result.isArrhythmia || false,
      feedbackState: {
        heartRateConfidence: updatedFeedback.heartRate.confidence,
        signalStrength: updatedFeedback.signalQuality.signalStrength,
        fingerDetection: updatedFeedback.signalQuality.fingerDetectionConfidence
      }
    });
  } else {
    // Actualizar el estado para indicar que no hay pico
    const updatedFeedback = updateHeartRateFeedback(
      feedbackState,
      {
        currentBPM: result.bpm || feedbackState.heartRate.currentBPM,
        confidence: result.confidence,
        peakStrength: Math.abs(value),
        rhythmStability: result.rhythmVariability ? 1 - result.rhythmVariability : feedbackState.heartRate.rhythmStability,
        isPeak: false
      }
    );
    
    // Update global feedback state con isPeak = false
    updateGlobalFeedbackState(updatedFeedback);
  }
}
