/**
 * Medical-grade utilities for signal logging and analysis
 * with extremely strict validation requirements to prevent false positives
 */

/**
 * Updates the signal log with incredibly strict validation, maintaining a manageable size
 * and preventing any simulated or invalid data
 */
export function updateSignalLog(
  signalLog: {timestamp: number, value: number, result: any}[],
  currentTime: number,
  value: number,
  result: any,
  processedSignals: number
): {timestamp: number, value: number, result: any}[] {
  // Ultra-aggressive input validation for medical-grade reliability
  if (isNaN(value) || !isFinite(value) || value < 0) {
    console.warn("signalLogUtils: Rejected invalid signal value");
    return signalLog;
  }
  
  if (isNaN(currentTime) || currentTime <= 0) {
    console.warn("signalLogUtils: Rejected invalid timestamp");
    return signalLog;
  }
  
  if (!result) {
    console.warn("signalLogUtils: Rejected null result");
    return signalLog;
  }
  
  // Additional extreme validations to prevent false data
  if (value > 200 || value < 0.1) {
    console.warn("signalLogUtils: Rejected physiologically implausible signal value", value);
    return signalLog;
  }
  
  // Calculate signal quality based on variance and stability
  // to detect potential false positives in history
  if (signalLog.length > 5) {
    const recentValues = signalLog.slice(-5).map(entry => entry.value);
    const variance = calculateVariance(recentValues);
    
    // Extremely low variance is a major red flag for false readings (no finger)
    // Increased threshold to 0.05
    if (variance < 0.05) {
      console.warn("signalLogUtils: Rejected signal with suspiciously low variance (potential false positive)", variance);
      return signalLog;
    }
    
    // Reject implausibly high variance (likely noise, not physiological)
    if (variance > 100) {
      console.warn("signalLogUtils: Rejected signal with excessively high variance (likely noise)", variance);
      return signalLog;
    }
    
    // Check for suspiciously uniform/artificial pattern
    const differences = [];
    for (let i = 1; i < recentValues.length; i++) {
      differences.push(Math.abs(recentValues[i] - recentValues[i-1]));
    }
    
    const meanDiff = differences.reduce((sum, v) => sum + v, 0) / differences.length;
    const diffVariance = differences.reduce((sum, v) => sum + Math.pow(v - meanDiff, 2), 0) / differences.length;
    
    // If differences are too consistent, could be artificially generated
    if (diffVariance < 0.01 && meanDiff > 0) {
      console.warn("signalLogUtils: Rejected suspiciously uniform signal pattern", { diffVariance, meanDiff });
      return signalLog;
    }
  }
  
  // Only log each X signals to prevent memory issues
  if (processedSignals % 15 !== 0) { // Reduced frequency for better performance
    return signalLog;
  }
  
  // Deep clone result to prevent reference issues
  const safeResult = {...result};
  
  // Validate specific result fields with ultra-aggressive thresholds
  if (safeResult.spo2 !== undefined) {
    // SpO2 must be between 0-100
    if (safeResult.spo2 < 0 || safeResult.spo2 > 100) {
      safeResult.spo2 = 0; // Reset invalid values
    }
    
    // Additional physiological validation
    // Real SpO2 values from PPG typically don't change more than 2-3% per reading
    if (signalLog.length > 0) {
      const lastSpo2 = signalLog[signalLog.length - 1].result.spo2;
      if (lastSpo2 > 0 && safeResult.spo2 > 0 && Math.abs(safeResult.spo2 - lastSpo2) > 3) {
        console.warn("signalLogUtils: Detected physiologically implausible SpO2 change");
        safeResult.spo2 = 0;
      }
    }
    
    // Suspicious if SpO2 is exactly 98-100% (too perfect, often in simulations)
    if (safeResult.spo2 >= 98 && safeResult.spo2 <= 100) {
      console.warn("signalLogUtils: Suspiciously perfect SpO2 value detected", safeResult.spo2);
      // We'll be skeptical of this perfect value
      if (signalLog.length === 0 || signalLog[signalLog.length - 1].result.spo2 < 97) {
        safeResult.spo2 = 0; // Reset suspicious first-time perfect values
      }
    }
  }
  
  // Validate glucose values for physiological plausibility with tighter constraints
  if (safeResult.glucose !== undefined) {
    if (safeResult.glucose < 0 || safeResult.glucose > 400) {
      safeResult.glucose = 0;
    }
    
    // Check for implausibly rapid changes
    if (signalLog.length > 0) {
      const lastGlucose = signalLog[signalLog.length - 1].result.glucose;
      if (lastGlucose > 0 && safeResult.glucose > 0) {
        const changePercent = Math.abs((safeResult.glucose - lastGlucose) / lastGlucose) * 100;
        if (changePercent > 10) { // Tightened threshold for better reliability
          console.warn("signalLogUtils: Detected physiologically implausible glucose change", { 
            prev: lastGlucose, 
            current: safeResult.glucose,
            changePercent
          });
          safeResult.glucose = 0;
        }
      }
    }
  }
  
  // Check if result has confidence info and validate it
  if (safeResult.confidence) {
    if (safeResult.confidence.overall < 0.3) {
      // Reset all values that rely on confidence if overall confidence is too low
      if (safeResult.glucose !== undefined) safeResult.glucose = 0;
      if (safeResult.lipids !== undefined) {
        safeResult.lipids.totalCholesterol = 0;
        safeResult.lipids.triglycerides = 0;
      }
      
      console.warn("signalLogUtils: Low confidence measurements rejected", safeResult.confidence);
    }
  }
  
  const updatedLog = [
    ...signalLog,
    {
      timestamp: currentTime,
      value,
      result: safeResult
    }
  ];
  
  // Keep log at manageable size but reduced for better performance
  const trimmedLog = updatedLog.length > 60 ? updatedLog.slice(-60) : updatedLog;
  
  // Enhanced logging for medical application
  console.log("signalLogUtils: Log updated", {
    totalEntries: trimmedLog.length,
    lastEntry: trimmedLog[trimmedLog.length - 1],
    dataValidated: true,
    signalQuality: calculateSignalQuality(trimmedLog.slice(-10).map(entry => entry.value))
  });
  
  return trimmedLog;
}

/**
 * Validates a signal value against physiological limits
 * with extremely aggressive validation to prevent false data from being processed
 */
export function validateSignalValue(value: number): boolean {
  // Check for NaN or Infinity
  if (isNaN(value) || !isFinite(value)) {
    return false;
  }
  
  // Check strict physiological limits
  if (value < 0 || value > 200) {
    return false;
  }
  
  // Additional validation for implausible values
  if (value < 0.1) { // Increased minimum threshold
    return false; // Too weak to be real signal
  }
  
  return true;
}

/**
 * Calculate signal quality based on variance and stability
 * with much stricter criteria to prevent false positives
 */
export function calculateSignalQuality(values: number[]): number {
  if (!values || values.length < 10) { // Increased requirement
    return 0;
  }
  
  // Calculate variance with aggressive validation
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  // Check for suspiciously low variance (potential false positive)
  if (variance < 0.15) { // Increased threshold
    return Math.min(10, Math.round(variance * 100)); // Severely penalize low variance
  }
  
  // Calculate stability (consistent spacing between peaks)
  const peaks = findSignalPeaks(values);
  let stabilityScore = 100;
  
  if (peaks.length >= 5) { // Increased requirement
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    const intervalMean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const intervalVariance = intervals.reduce((sum, val) => sum + Math.pow(val - intervalMean, 2), 0) / intervals.length;
    
    // Higher variance = lower stability
    stabilityScore = 100 - Math.min(100, (intervalVariance / intervalMean) * 200); // Much more aggressive penalty
  } else {
    stabilityScore = 10; // Severely penalize insufficient peaks
  }
  
  // Combine variance and stability for final quality score with more weight on stability
  // Variance should be in a sweet spot - too low or too high is bad
  const varianceScore = variance < 1.0 ? 5 + (variance * 20) : 
                        variance > 60 ? 25 :
                        70 - Math.min(50, Math.abs(variance - 18)); // Adjusted sweet spot range
  
  // Apply a much more aggressive weighting that highly favors stability
  const weightedScore = Math.round((varianceScore * 0.25) + (stabilityScore * 0.75));
  
  // Additional penalty for too few peaks (likely not a real signal)
  const peakPenalty = peaks.length < 4 ? 0.3 : // Severe penalty
                      peaks.length < 6 ? 0.7 : 1.0;
  
  return Math.round(weightedScore * peakPenalty);
}

/**
 * Find peaks in signal with extremely strict validation criteria
 */
function findSignalPeaks(values: number[]): number[] {
  if (values.length < 12) return []; // Significantly increased requirement
  
  const peaks = [];
  const MIN_PEAK_DISTANCE = 8; // Increased for better physiological plausibility
  
  // Calculate adaptive threshold with much higher minimum
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const threshold = Math.max(1.0, (max - min) * 0.5); // Drastically increased threshold
  
  for (let i = 4; i < values.length - 4; i++) { // Wider window
    if (values[i] > values[i-1] && 
        values[i] > values[i-2] && 
        values[i] > values[i-3] && 
        values[i] > values[i-4] && // Extra check
        values[i] > values[i+1] && 
        values[i] > values[i+2] &&
        values[i] > values[i+3] &&
        values[i] > values[i+4] && // Extra check
        values[i] - Math.min(values[i-4], values[i-3], values[i-2], values[i-1], values[i+1], values[i+2], values[i+3], values[i+4]) > threshold) {
      
      // Check if this peak is far enough from previous peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= MIN_PEAK_DISTANCE) {
        peaks.push(i);
      }
    }
  }
  
  return peaks;
}

/**
 * Helper function to calculate variance of an array of values
 */
function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}
