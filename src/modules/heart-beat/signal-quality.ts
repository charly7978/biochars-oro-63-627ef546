
/**
 * Functions for checking signal quality
 * Direct measurement only - NO simulation or data manipulation
 */

/**
 * Check if the signal quality is sufficient for processing
 * Uses only real measurements without simulation
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
  // Get actual threshold from config or use default
  const threshold = config.lowSignalThreshold || 0.05;
  const maxCount = config.maxWeakSignalCount || 10;
  
  // Check real signal against threshold
  const isCurrentlyWeak = Math.abs(value) < threshold;
  
  // Update counter based on actual signal strength
  let updatedCount = isCurrentlyWeak 
    ? consecutiveWeakSignalsCount + 1 
    : 0;
  
  // Determine if signal is weak based on consecutive measurements
  const isWeak = updatedCount >= maxCount;
  
  return {
    isWeakSignal: isWeak,
    updatedWeakSignalsCount: updatedCount
  };
}

/**
 * Reset detection states for fresh measurements
 */
export function resetDetectionStates() {
  console.log("Signal quality: Reset detection states");
  return {
    consecutiveWeakSignals: 0
  };
}

/**
 * Check if finger is detected by identifying rhythmic patterns
 * Works only with real data, no simulation
 */
export function isFingerDetectedByPattern(
  signalHistory: Array<{time: number, value: number}>,
  currentPatternCount: number
): {
  isFingerDetected: boolean,
  patternCount: number
} {
  if (signalHistory.length < 10) {
    return { 
      isFingerDetected: false, 
      patternCount: 0 
    };
  }
  
  // Look for physiological patterns in real signal
  let crossings = 0;
  const recentValues = signalHistory.slice(-10);
  const mean = recentValues.reduce((sum, point) => sum + point.value, 0) / recentValues.length;
  
  // Count zero crossings (signal moving above/below mean)
  for (let i = 1; i < recentValues.length; i++) {
    if ((recentValues[i].value > mean && recentValues[i-1].value <= mean) ||
        (recentValues[i].value <= mean && recentValues[i-1].value > mean)) {
      crossings++;
    }
  }
  
  // Physiological heart rate should have 2-5 crossings in this window
  const hasPhysiologicalPattern = crossings >= 2 && crossings <= 5;
  
  // Update pattern detection count
  let newPatternCount = hasPhysiologicalPattern 
    ? currentPatternCount + 1 
    : Math.max(0, currentPatternCount - 1);
  
  // Only detect finger after consistent pattern detection
  const isDetected = newPatternCount >= 3;
  
  return {
    isFingerDetected: isDetected,
    patternCount: newPatternCount
  };
}
