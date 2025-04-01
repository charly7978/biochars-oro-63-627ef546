
/**
 * Functions for checking signal quality and weak signals
 */

/**
 * Checks if a PPG signal is of good quality for heartbeat detection
 */
export function checkSignalQuality(
  value: number,
  consecutiveWeakSignalsCount: number,
  config: {
    lowSignalThreshold: number,
    maxWeakSignalCount: number
  }
): {
  isWeakSignal: boolean,
  updatedWeakSignalsCount: number
} {
  // Check if the signal is too weak
  const isValueWeak = Math.abs(value) < config.lowSignalThreshold;
  
  // Asymmetric counter: increase slowly but decrease quickly
  // This helps prevent false positives by requiring sustained strong signals
  let updatedCount = consecutiveWeakSignalsCount;
  
  if (isValueWeak) {
    // Increment by 1 for weak signals (slow increase)
    updatedCount++;
  } else {
    // Decrease by 3 for strong signals (rapid recovery)
    updatedCount = Math.max(0, updatedCount - 3);
  }
  
  // Signal is considered weak if we've had too many consecutive weak readings
  const isWeakSignal = updatedCount >= config.maxWeakSignalCount;
  
  return {
    isWeakSignal,
    updatedWeakSignalsCount: updatedCount
  };
}

/**
 * Resets detection state when signal quality is poor
 */
export function resetDetectionStates() {
  console.log("Signal quality: reset detection states (low signal)");
  return {
    lastPeakTime: null,
    previousPeakTime: null,
    lastConfirmedPeak: false,
    peakConfirmationBuffer: []
  };
}

/**
 * Calculate weighted signal quality score based on amplitude and stability
 */
export function calculateWeightedQuality(ppgValues: number[]): number {
  if (ppgValues.length < 10) return 0;
  
  // Calculate signal statistics
  const recentValues = ppgValues.slice(-15);
  const min = Math.min(...recentValues);
  const max = Math.max(...recentValues);
  const amplitude = max - min;
  
  // Calculate stability (coefficient of variation)
  const sum = recentValues.reduce((a, b) => a + b, 0);
  const mean = sum / recentValues.length;
  const squaredDiffs = recentValues.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / recentValues.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean !== 0 ? stdDev / Math.abs(mean) : 999;
  
  // Base quality on amplitude and stability
  const amplitudeQuality = Math.min(100, amplitude * 400);
  const stabilityPenalty = Math.min(amplitudeQuality * 0.8, cv * 150);
  
  return Math.max(0, Math.min(100, amplitudeQuality - stabilityPenalty));
}
