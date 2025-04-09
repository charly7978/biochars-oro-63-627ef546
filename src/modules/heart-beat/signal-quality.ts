
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
  // Safety checks for invalid input
  if (isNaN(value)) {
    console.warn("Signal quality received NaN value");
    return { isWeakSignal: true, updatedWeakSignalsCount: consecutiveWeakSignalsCount + 1 };
  }

  // Get actual threshold from config or use default
  const threshold = config.lowSignalThreshold || 0.05;
  const maxCount = config.maxWeakSignalCount || 10;
  
  // Check real signal against threshold
  const isCurrentlyWeak = Math.abs(value) < threshold;
  
  // Update counter based on actual signal strength
  let updatedCount = isCurrentlyWeak 
    ? consecutiveWeakSignalsCount + 1 
    : Math.max(0, consecutiveWeakSignalsCount - 2); // Decrease counter faster for good signals
  
  // Determine if signal is weak based on consecutive measurements
  const isWeak = updatedCount >= maxCount;
  
  // Log for debugging if signal status changes
  if ((isWeak && updatedCount === maxCount) || (!isWeak && updatedCount === 0)) {
    console.log("Signal quality status change:", {
      isWeak,
      value: Math.abs(value),
      threshold,
      updatedCount,
      maxCount
    });
  }
  
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
  // Safety check for invalid or insufficient data
  if (!signalHistory || signalHistory.length < 10) {
    return { 
      isFingerDetected: false, 
      patternCount: 0 
    };
  }
  
  // Look for physiological patterns in real signal
  let crossings = 0;
  const recentValues = signalHistory.slice(-10);
  const sum = recentValues.reduce((acc, point) => acc + point.value, 0); 
  const mean = sum / recentValues.length;
  
  // Count zero crossings (signal moving above/below mean)
  for (let i = 1; i < recentValues.length; i++) {
    if ((recentValues[i].value > mean && recentValues[i-1].value <= mean) ||
        (recentValues[i].value <= mean && recentValues[i-1].value > mean)) {
      crossings++;
    }
  }
  
  // Check amplitude - a finger should produce a reasonable amplitude
  const minValue = Math.min(...recentValues.map(point => point.value));
  const maxValue = Math.max(...recentValues.map(point => point.value));
  const amplitude = maxValue - minValue;
  const hasReasonableAmplitude = amplitude > 0.02; // Lowered threshold for sensitivity
  
  // Physiological heart rate should have 2-5 crossings in this window
  const hasPhysiologicalPattern = (crossings >= 1 && crossings <= 6) && hasReasonableAmplitude;
  
  // Update pattern detection count with faster detection
  let newPatternCount = hasPhysiologicalPattern 
    ? currentPatternCount + 1 
    : Math.max(0, currentPatternCount - 1);
  
  // Only detect finger after consistent pattern detection (reduced requirement)
  const isDetected = newPatternCount >= 2; // Reduced from 3 for faster detection
  
  // Log status changes
  if ((isDetected && newPatternCount === 2) || (!isDetected && newPatternCount === 0 && currentPatternCount > 0)) {
    console.log("Finger detection status change:", {
      isDetected,
      crossings,
      amplitude,
      newPatternCount
    });
  }
  
  return {
    isFingerDetected: isDetected,
    patternCount: newPatternCount
  };
}
