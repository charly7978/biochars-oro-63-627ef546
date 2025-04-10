
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
