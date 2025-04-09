
/**
 * Functions for checking signal quality and detecting finger presence
 */

/**
 * Check if finger is detected based on signal pattern analysis
 */
export function isFingerDetectedByPattern(
  signalHistory: Array<{time: number, value: number}>,
  currentPatternCount: number
): { patternCount: number, isFingerDetected: boolean } {
  // Only process if we have enough data points
  if (signalHistory.length < 15) {
    return { patternCount: currentPatternCount, isFingerDetected: false };
  }
  
  // Extract values and calculate variance
  const values = signalHistory.map(point => point.value);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  // Check minimum variance (reject constant signals)
  if (variance < 0.01) {
    return { 
      patternCount: Math.max(0, currentPatternCount - 1), 
      isFingerDetected: false 
    };
  }
  
  // Find peaks in the signal
  const peaks: number[] = [];
  for (let i = 2; i < values.length - 2; i++) {
    if (values[i] > values[i-1] && 
        values[i] > values[i-2] && 
        values[i] > values[i+1] && 
        values[i] > values[i+2] &&
        values[i] > mean * 1.2) {
      peaks.push(i);
    }
  }
  
  // Check for enough peaks and consistent intervals
  if (peaks.length >= 3) {
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Check for consistent intervals (regular rhythm)
    let consistentIntervals = 0;
    for (let i = 1; i < intervals.length; i++) {
      if (Math.abs(intervals[i] - intervals[i-1]) / intervals[i-1] < 0.3) {
        consistentIntervals++;
      }
    }
    
    // If we detect consistent rhythm, increment pattern count
    if (consistentIntervals > 0) {
      const newPatternCount = currentPatternCount + 1;
      return {
        patternCount: newPatternCount,
        isFingerDetected: newPatternCount >= 3
      };
    }
  }
  
  // Decrease pattern count if no consistent rhythm found
  return { 
    patternCount: Math.max(0, currentPatternCount - 1), 
    isFingerDetected: currentPatternCount >= 3 
  };
}

/**
 * Reset detection states
 */
export function resetDetectionStates(): void {
  console.log("Signal quality: Resetting detection states");
}
