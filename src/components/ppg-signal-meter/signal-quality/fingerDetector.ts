
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
  // Much more permissive thresholds for better detection
  const hasStableDetection = detectionStabilityCounter >= Math.floor(REQUIRED_STABILITY_FRAMES * 0.5); // 50% of required frames
  const hasMinimumQuality = avgQuality > 20; // Significantly lowered from 35
  const hasRequiredFrames = consecutiveFingerFrames >= Math.floor(REQUIRED_FINGER_FRAMES * 0.6); // 60% of required frames
  
  let hasSignalVariability = false;
  if (derivativeBuffer.length > 8) { // Reduced from 10
    const maxDerivative = Math.max(...derivativeBuffer);
    hasSignalVariability = maxDerivative > MIN_DERIVATIVE_THRESHOLD * 0.5; // 50% of threshold
  }
  
  let hasSufficientAmplitude = false;
  if (signalAmplitudeHistory.length > 8) { // Reduced from 10
    const avgAmplitude = signalAmplitudeHistory.reduce((sum, a) => sum + a, 0) / 
                        signalAmplitudeHistory.length;
    hasSufficientAmplitude = avgAmplitude > MIN_AMPLITUDE_THRESHOLD * 0.6; // 60% of threshold
  }
  
  // Additional check for fluctuation pattern typical of PPG signals - more permissive
  let hasFluctuationPattern = false;
  if (derivativeBuffer.length > 10) { // Reduced from 15
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
    hasFluctuationPattern = alternatingDirections >= 2; // Reduced from 3
  }
  
  // Check for trending pattern in amplitude history
  let hasConsistentTrend = false;
  if (signalAmplitudeHistory.length > 10) {
    let increasingCount = 0;
    let decreasingCount = 0;
    
    for (let i = 1; i < signalAmplitudeHistory.length; i++) {
      if (signalAmplitudeHistory[i] > signalAmplitudeHistory[i-1]) {
        increasingCount++;
      } else if (signalAmplitudeHistory[i] < signalAmplitudeHistory[i-1]) {
        decreasingCount++;
      }
    }
    
    // If we have a mix of increases and decreases, it suggests a pulsing pattern
    const hasAlternatingPattern = increasingCount >= 3 && decreasingCount >= 3;
    
    // Or if we have a strong trend in one direction
    const hasStrongTrend = Math.max(increasingCount, decreasingCount) > signalAmplitudeHistory.length * 0.7;
    
    hasConsistentTrend = hasAlternatingPattern || hasStrongTrend;
  }
  
  // MUCH more permissive logic - only require some conditions to be true
  // We need: decent quality AND (any of the signal pattern indicators)
  const hasQualityIndicator = hasMinimumQuality || hasStableDetection;
  const hasPatternIndicator = 
    hasRequiredFrames || 
    hasSignalVariability || 
    hasSufficientAmplitude || 
    hasFluctuationPattern ||
    hasConsistentTrend;
  
  // Log detection details occasionally for debugging
  if (Math.random() < 0.05) {
    console.log("FingerDetector: Detection details", {
      avgQuality,
      hasMinimumQuality,
      hasStableDetection,
      hasRequiredFrames,
      hasSignalVariability,
      hasSufficientAmplitude,
      hasFluctuationPattern,
      hasConsistentTrend,
      finalDetection: hasQualityIndicator && hasPatternIndicator
    });
  }
  
  return hasQualityIndicator && hasPatternIndicator;
}
