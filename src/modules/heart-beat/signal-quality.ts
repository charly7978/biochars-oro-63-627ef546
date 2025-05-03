
/**
 * Utility functions for signal quality assessment
 * Only processes real data
 */

interface SignalQualityConfig {
  lowSignalThreshold: number;
  maxWeakSignalCount: number;
}

/**
 * Checks signal quality to determine if the signal is too weak
 * @param value Current value to check
 * @param consecutiveWeakSignals Current count of consecutive weak signals
 * @param config Configuration parameters
 * @returns Object with isWeakSignal and updatedWeakSignalsCount
 */
export function checkSignalQuality(
  value: number,
  consecutiveWeakSignals: number,
  config: SignalQualityConfig
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } {
  const { lowSignalThreshold, maxWeakSignalCount } = config;
  
  // Calculate absolute value without Math.abs
  const absValue = value >= 0 ? value : -value;
  
  // Check if signal is below threshold
  const isCurrentlyWeak = absValue < lowSignalThreshold;
  
  // Update consecutive weak signals count
  let updatedWeakSignalsCount = isCurrentlyWeak
    ? consecutiveWeakSignals + 1
    : consecutiveWeakSignals > 0 
      ? consecutiveWeakSignals - 1 
      : 0;
  
  // Log for debugging
  if (updatedWeakSignalsCount > 3) {
    console.log("Signal quality check:", {
      value,
      absValue,
      isCurrentlyWeak,
      updatedWeakSignalsCount,
      maxWeakSignalCount
    });
  }
  
  // Determine if signal is considered weak overall
  const isWeakSignal = updatedWeakSignalsCount >= maxWeakSignalCount;
  
  return { isWeakSignal, updatedWeakSignalsCount };
}

/**
 * Calculates a quality percentage for the signal
 * Higher values indicate better quality
 * @param values Array of recent signal values
 * @returns Quality value from 0-100
 */
export function calculateSignalQuality(values: number[]): number {
  if (!values || values.length < 10) return 0;
  
  // Take most recent values
  const recentValues = values.slice(-10);
  
  // Find min and max without Math functions
  let min = recentValues[0];
  let max = recentValues[0];
  let sum = recentValues[0];
  
  for (let i = 1; i < recentValues.length; i++) {
    if (recentValues[i] < min) min = recentValues[i];
    if (recentValues[i] > max) max = recentValues[i];
    sum += recentValues[i];
  }
  
  const range = max - min;
  const avg = sum / recentValues.length;
  
  // Calculate variation
  let varianceSum = 0;
  for (let i = 0; i < recentValues.length; i++) {
    const diff = recentValues[i] - avg;
    varianceSum += diff * diff;
  }
  
  const variance = varianceSum / recentValues.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Calculate signal-to-noise ratio (SNR)
  const snr = range / (standardDeviation || 0.001);
  
  // Convert to 0-100 scale
  let quality = snr * 20;
  
  // Ensure within bounds
  if (quality < 0) quality = 0;
  if (quality > 100) quality = 100;
  
  return quality;
}

/**
 * Assessment of signal quality for processor
 * @param values Array of signal values
 * @returns Quality 0-100
 */
export function assessSignalQuality(values: number[]): number {
  return calculateSignalQuality(values);
}

/**
 * Resets the signal quality state
 * @returns The reset value for signal quality counter (0)
 */
export function resetSignalQualityState(): number {
  // This function resets the signal quality tracking state to its initial value
  return 0;
}
