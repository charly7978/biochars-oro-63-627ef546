
/**
 * Checks signal quality based on signal strength and consistency
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
  const isWeakSignal = Math.abs(value) < config.lowSignalThreshold;
  
  let updatedWeakSignalsCount = consecutiveWeakSignalsCount;
  if (isWeakSignal) {
    updatedWeakSignalsCount += 1;
  } else {
    updatedWeakSignalsCount = Math.max(0, updatedWeakSignalsCount - 1);
  }
  
  return {
    isWeakSignal: updatedWeakSignalsCount >= config.maxWeakSignalCount,
    updatedWeakSignalsCount
  };
}

/**
 * Detects if a finger is present based on rhythmic patterns in the signal
 */
export function isFingerDetectedByPattern(
  signalHistory: number[],
  currentPatternCount: number
): {
  isFingerDetected: boolean,
  patternCount: number
} {
  if (signalHistory.length < 30) {
    return { 
      isFingerDetected: false,
      patternCount: 0
    };
  }
  
  // Look for rhythmic patterns in the signal
  let patternCount = currentPatternCount;
  
  // Simple periodic pattern detection
  const recentValues = typeof signalHistory[0] === 'number' 
    ? signalHistory.slice(-30) 
    : signalHistory.slice(-30).map(point => typeof point === 'number' ? point : (point as any).value);
    
  const min = Math.min(...recentValues as number[]);
  const max = Math.max(...recentValues as number[]);
  const range = max - min;
  
  // Check if we have sufficient variation for a physiological signal
  if (range < 0.1) {
    return { 
      isFingerDetected: false,
      patternCount: Math.max(0, patternCount - 1)
    };
  }
  
  // Count zero crossings as a basic rhythm detection
  let crossings = 0;
  const mean = recentValues.reduce((sum, val) => sum + (val as number), 0) / recentValues.length;
  
  for (let i = 1; i < recentValues.length; i++) {
    if (((recentValues[i-1] as number) - mean) * ((recentValues[i] as number) - mean) < 0) {
      crossings++;
    }
  }
  
  // Physiological signals typically have consistent crossings
  const isRhythmic = crossings >= 2 && crossings <= 15;
  
  if (isRhythmic) {
    patternCount = Math.min(10, patternCount + 1);
  } else {
    patternCount = Math.max(0, patternCount - 1);
  }
  
  return {
    isFingerDetected: patternCount >= 3,
    patternCount
  };
}
