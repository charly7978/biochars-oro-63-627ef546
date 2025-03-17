
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
  // More permissive thresholds
  const hasStableDetection = detectionStabilityCounter >= Math.floor(REQUIRED_STABILITY_FRAMES * 0.6); // 60% of required frames
  const hasMinimumQuality = avgQuality > 25; // Lowered from 35
  const hasRequiredFrames = consecutiveFingerFrames >= Math.floor(REQUIRED_FINGER_FRAMES * 0.7); // 70% of required frames
  
  let hasSignalVariability = false;
  if (derivativeBuffer.length > 10) {
    const maxDerivative = Math.max(...derivativeBuffer);
    hasSignalVariability = maxDerivative > MIN_DERIVATIVE_THRESHOLD * 0.6; // 60% of threshold
  }
  
  let hasSufficientAmplitude = false;
  if (signalAmplitudeHistory.length > 10) {
    const avgAmplitude = signalAmplitudeHistory.reduce((sum, a) => sum + a, 0) / 
                        signalAmplitudeHistory.length;
    hasSufficientAmplitude = avgAmplitude > MIN_AMPLITUDE_THRESHOLD * 0.7; // 70% of threshold
  }
  
  // Additional check for fluctuation pattern typical of PPG signals
  let hasFluctuationPattern = false;
  if (derivativeBuffer.length > 15) {
    let alternatingDirections = 0;
    let prevDirection = 0;
    
    for (let i = 1; i < derivativeBuffer.length; i++) {
      const direction = derivativeBuffer[i] > derivativeBuffer[i-1] ? 1 : -1;
      if (prevDirection !== 0 && direction !== prevDirection) {
        alternatingDirections++;
      }
      prevDirection = direction;
    }
    
    // PPG signals typically have direction changes (alternating dips and rises)
    hasFluctuationPattern = alternatingDirections >= 3;
  }
  
  // More permissive logic - only require some of the conditions to be true
  return (hasStableDetection && hasMinimumQuality && 
         (hasRequiredFrames || hasSignalVariability || hasSufficientAmplitude || hasFluctuationPattern));
}
