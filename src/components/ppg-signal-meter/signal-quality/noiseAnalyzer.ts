
/**
 * Utility for analyzing noise levels in signal data.
 * This module provides functions to quantify the amount of noise in PPG signal data,
 * which is crucial for determining signal quality and reliability.
 */

/**
 * Calculates the noise level in a signal by measuring the signal's variability
 * relative to its mean value. Higher values indicate more noise.
 * 
 * The method uses standard deviation normalized by the mean to provide
 * a scale-invariant measure of noise.
 * 
 * @param values - Array of signal values to analyze for noise
 * @returns A normalized noise level indicator (higher values = more noise)
 */
export function calculateNoiseLevel(values: number[]): number {
  if (values.length === 0) return 0;
  
  // Calculate mean
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  // Calculate variance
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  // Calculate standard deviation
  const stdDev = Math.sqrt(variance);
  
  // Normalize by the mean (with small epsilon to avoid division by zero)
  return stdDev / (Math.abs(mean) + 0.001);
}
