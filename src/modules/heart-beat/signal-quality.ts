
/**
 * Functions for assessing PPG signal quality
 */

/**
 * Checks if signal quality is low (potentially finger removed)
 */
export function checkSignalQuality(
  amplitude: number,
  weakSignalsCount: number,
  config: {
    lowSignalThreshold: number,
    maxWeakSignalCount: number
  }
): {
  isWeakSignal: boolean,
  updatedWeakSignalsCount: number
} {
  let updatedCount = weakSignalsCount;
  
  if (Math.abs(amplitude) < config.lowSignalThreshold) {
    updatedCount++;
  } else {
    updatedCount = 0;
  }
  
  return {
    isWeakSignal: updatedCount > config.maxWeakSignalCount,
    updatedWeakSignalsCount: updatedCount
  };
}

/**
 * Resets detection states when signal is lost
 */
export function resetDetectionStates() {
  return {
    lastPeakTime: null,
    previousPeakTime: null,
    lastConfirmedPeak: false,
    peakCandidateIndex: null,
    peakCandidateValue: 0,
    peakConfirmationBuffer: [],
    values: []
  };
}
