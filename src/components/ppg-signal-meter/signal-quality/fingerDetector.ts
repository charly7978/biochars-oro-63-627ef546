
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 * 
 * Utilities for finger detection from signal characteristics
 */
import {
  REQUIRED_STABILITY_FRAMES,
  MIN_DERIVATIVE_THRESHOLD,
  MIN_AMPLITUDE_THRESHOLD,
  REQUIRED_FINGER_FRAMES
} from './constants';

export function detectFingerPresence(
  avgQuality: number,
  detectionStabilityCounter: number,
  consecutiveFingerFrames: number,
  derivativeBuffer: number[],
  signalAmplitudeHistory: number[]
): boolean {
  const hasStableDetection = detectionStabilityCounter >= REQUIRED_STABILITY_FRAMES;
  const hasMinimumQuality = avgQuality > 35;
  const hasRequiredFrames = consecutiveFingerFrames >= REQUIRED_FINGER_FRAMES;
  
  let hasSignalVariability = false;
  if (derivativeBuffer.length > 10) {
    const maxDerivative = Math.max(...derivativeBuffer);
    hasSignalVariability = maxDerivative > MIN_DERIVATIVE_THRESHOLD;
  }
  
  let hasSufficientAmplitude = false;
  if (signalAmplitudeHistory.length > 10) {
    const avgAmplitude = signalAmplitudeHistory.reduce((sum, a) => sum + a, 0) / 
                        signalAmplitudeHistory.length;
    hasSufficientAmplitude = avgAmplitude > MIN_AMPLITUDE_THRESHOLD;
  }
  
  return hasStableDetection && hasMinimumQuality && hasRequiredFrames && 
         (hasSignalVariability || hasSufficientAmplitude);
}
