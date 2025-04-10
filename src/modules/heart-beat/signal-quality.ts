/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsConfig } from '../../core/config/VitalSignsConfig';

interface SignalQualityOptions {
  lowSignalThreshold?: number;
  maxWeakSignalCount?: number;
}

interface SignalQualityResult {
  isWeakSignal: boolean;
  updatedWeakSignalsCount: number;
}

/**
 * Check signal quality using centralized configuration
 * @param value Current signal value
 * @param weakSignalsCount Current count of consecutive weak signals
 * @param options Optional configuration overrides
 * @returns Object with updated weak signal status and count
 */
export function checkSignalQuality(
  value: number,
  weakSignalsCount: number,
  options?: SignalQualityOptions
): SignalQualityResult {
  // Use provided options or defaults from config
  const lowSignalThreshold = options?.lowSignalThreshold || 
    VitalSignsConfig.fingerDetection.LOW_SIGNAL_THRESHOLD;
  
  const maxWeakSignals = options?.maxWeakSignalCount || 
    VitalSignsConfig.fingerDetection.MAX_WEAK_SIGNALS;
  
  // Check if signal is weak
  const isCurrentSignalWeak = Math.abs(value) < lowSignalThreshold;
  
  // Update weak signals counter
  let updatedWeakSignalsCount = weakSignalsCount;
  
  if (isCurrentSignalWeak) {
    updatedWeakSignalsCount += 1;
  } else {
    updatedWeakSignalsCount = Math.max(0, updatedWeakSignalsCount - 1);
  }
  
  // Determine if signal is considered weak based on consecutive weak signals
  const isWeakSignal = updatedWeakSignalsCount >= maxWeakSignals;
  
  return {
    isWeakSignal,
    updatedWeakSignalsCount
  };
}

/**
 * Verify signal amplitude is within physiological range
 * @param values Array of signal values to check
 * @returns Boolean indicating if the amplitude is valid
 */
export function hasValidAmplitude(values: number[]): boolean {
  if (values.length < 2) return false;
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const amplitude = max - min;
  
  return amplitude >= VitalSignsConfig.signal.QUALITY.MIN_AMPLITUDE && 
         amplitude <= VitalSignsConfig.signal.QUALITY.MAX_AMPLITUDE;
}

/**
 * Check overall signal quality based on multiple parameters
 * @param values Signal values to analyze
 * @returns Signal quality score between 0-1
 */
export function calculateSignalQuality(values: number[]): number {
  if (values.length < 10) return 0;
  
  // Check amplitude
  if (!hasValidAmplitude(values)) return 0;
  
  // Calculate variance normalized by mean
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 0;
  
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const normalizedVariance = variance / (mean * mean);
  
  // Ideal range for normalized variance: not too stable, not too chaotic
  const varianceScore = normalizedVariance > 0.01 && normalizedVariance < 0.3 
    ? 1 - Math.abs(0.1 - normalizedVariance) * 5 
    : 0;
  
  // Check for physiological oscillation pattern
  let oscillationCount = 0;
  for (let i = 1; i < values.length - 1; i++) {
    if ((values[i] > values[i-1] && values[i] > values[i+1]) || 
        (values[i] < values[i-1] && values[i] < values[i+1])) {
      oscillationCount++;
    }
  }
  
  const oscillationScore = oscillationCount / (values.length - 2);
  
  // Combine scores (weighted)
  return varianceScore * 0.7 + oscillationScore * 0.3;
}

/**
 * Check for rhythmic patterns in the signal history that would indicate a finger is present
 * @param signalHistory Recent signal history with timestamps
 * @param currentCount Current pattern detection count
 * @returns Updated detection state
 */
export function isFingerDetectedByPattern(
  signalHistory: Array<{time: number, value: number}>,
  currentCount: number
): { isFingerDetected: boolean, patternCount: number } {
  // Need enough data points to detect patterns
  if (signalHistory.length < 10) {
    return { isFingerDetected: false, patternCount: 0 };
  }
  
  // Extract just the values for analysis
  const values = signalHistory.map(point => point.value);
  
  // Calculate differences between adjacent points
  const differences = [];
  for (let i = 1; i < values.length; i++) {
    differences.push(values[i] - values[i-1]);
  }
  
  // Count sign changes (zero crossings)
  let zeroCrossings = 0;
  for (let i = 1; i < differences.length; i++) {
    if ((differences[i] > 0 && differences[i-1] < 0) || 
        (differences[i] < 0 && differences[i-1] > 0)) {
      zeroCrossings++;
    }
  }
  
  // Calculate zero crossing rate
  const zcrRate = zeroCrossings / differences.length;
  
  // Physiological rhythmic patterns typically have a specific range of zero crossing rates
  const isRhythmic = zcrRate > 0.15 && zcrRate < 0.6;
  
  // Check time consistency
  const times = signalHistory.map(point => point.time);
  const timeIntervals = [];
  for (let i = 1; i < times.length; i++) {
    timeIntervals.push(times[i] - times[i-1]);
  }
  
  // Calculate variance in time intervals
  const avgInterval = timeIntervals.reduce((sum, val) => sum + val, 0) / timeIntervals.length;
  const intervalVariance = timeIntervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / timeIntervals.length;
  
  // Consistent time intervals are important for valid physiological signals
  const isTimeConsistent = intervalVariance / (avgInterval * avgInterval) < 0.25;
  
  // Update pattern count
  let patternCount = currentCount;
  if (isRhythmic && isTimeConsistent) {
    patternCount += 1;
  } else {
    patternCount = Math.max(0, patternCount - 1);
  }
  
  // Need consistent pattern detection to confirm
  const isFingerDetected = patternCount >= 3;
  
  return { isFingerDetected, patternCount };
}
