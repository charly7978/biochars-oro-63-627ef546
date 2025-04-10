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
 * Maneja la detección de picos con retroalimentación bidireccional mejorada
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  try {
    const now = Date.now();
    
    // Obtener estado actual de feedback
    const feedbackState = getGlobalFeedbackState();
    
    // Solo procesar picos con confianza mínima ajustada por calidad de señal
    const minConfidence = 0.4 * (1 + feedbackState.signalQuality.signalStrength);
    
    if (result.isPeak && result.confidence > minConfidence) {
      // Actualizar tiempo del último pico
      lastPeakTimeRef.current = now;
      
      // Actualizar feedback de ritmo cardíaco
      const updatedFeedback = updateHeartRateFeedback(
        feedbackState,
        {
          currentBPM: result.bpm || feedbackState.heartRate.currentBPM,
          confidence: result.confidence,
          peakStrength: Math.abs(value),
          rhythmStability: result.rhythmVariability 
            ? 1 - result.rhythmVariability 
            : feedbackState.heartRate.rhythmStability,
          isPeak: true
        }
      );
      
      // Actualizar estado global de feedback
      updateGlobalFeedbackState(updatedFeedback);
      
      // Solicitar beep solo si la calidad de señal es buena
      if (
        isMonitoringRef.current && 
        result.confidence > 0.5 &&
        feedbackState.signalQuality.signalStrength > 0.4
      ) {
        // Ajustar volumen basado en la calidad de la señal
        const volume = Math.min(1, 0.7 + feedbackState.signalQuality.signalStrength * 0.3);
        requestBeepCallback(volume);
      }
    } else {
      // Actualizar feedback sin pico
      const updatedFeedback = updateHeartRateFeedback(
        feedbackState,
        {
          currentBPM: result.bpm || feedbackState.heartRate.currentBPM,
          confidence: result.confidence,
          peakStrength: Math.abs(value),
          rhythmStability: result.rhythmVariability 
            ? 1 - result.rhythmVariability 
            : feedbackState.heartRate.rhythmStability,
          isPeak: false
        }
      );
      
      updateGlobalFeedbackState(updatedFeedback);
    }
  } catch (error) {
    console.error('Error en detección de picos:', error);
    // No propagar el error para evitar interrumpir el procesamiento
  }
}
