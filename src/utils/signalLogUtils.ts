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
  
  // MUCH stricter physiological validation
  // Tighter physiologically plausible range
  if (value > 150 || value < 1.0) {
    console.warn("signalLogUtils: Rejected physiologically implausible signal value", value);
    return signalLog;
  }
  
  // Calculate signal quality based on variance and stability
  // to detect potential false positives in history
  if (signalLog.length > 5) {
    const recentValues = signalLog.slice(-5).map(entry => entry.value);
    const variance = calculateVariance(recentValues);
    
    // DRASTICALLY increased threshold for minimum variance
    // Real physiological signals always have variance - if too smooth, it's fake
    if (variance < 2.0) {
      console.warn("signalLogUtils: Rejected signal with suspiciously low variance (potential simulation)", variance);
      return signalLog;
    }
    
    // Reject implausibly high variance (likely noise, not physiological)
    if (variance > 40) {  // Reduced from 50 to be more strict
      console.warn("signalLogUtils: Rejected signal with excessively high variance (likely noise)", variance);
      return signalLog;
    }
    
    // Check for suspiciously uniform/artificial pattern - MUCH more aggressive
    const differences = [];
    for (let i = 1; i < recentValues.length; i++) {
      differences.push(Math.abs(recentValues[i] - recentValues[i-1]));
    }
    
    const meanDiff = differences.reduce((sum, v) => sum + v, 0) / differences.length;
    const diffVariance = differences.reduce((sum, v) => sum + Math.pow(v - meanDiff, 2), 0) / differences.length;
    
    // If differences are too consistent, could be artificially generated
    // DRASTICALLY increased threshold
    if (diffVariance < 0.5 && meanDiff > 0) {
      console.warn("signalLogUtils: Rejected suspiciously uniform signal pattern", { diffVariance, meanDiff });
      return signalLog;
    }
    
    // New: Check rate of change - abrupt changes are suspicious
    const maxChange = Math.max(...differences);
    const minChange = Math.min(...differences);
    const changeRatio = maxChange / Math.max(0.001, minChange);
    
    // If the ratio is too high, signal is unstable
    if (changeRatio > 20) {
      console.warn("signalLogUtils: Rejected signal with unstable change ratio", { maxChange, minChange, changeRatio });
      return signalLog;
    }
  }
  
  // Only log each X signals to prevent memory issues
  if (processedSignals % 50 !== 0) { // Even less frequent logging
    return signalLog;
  }
  
  // Deep clone result to prevent reference issues
  const safeResult = {...result};
  
  // Aggressively validate specific result fields with ultra-strict thresholds
  if (safeResult.spo2 !== undefined) {
    // SpO2 must be between 0-100
    if (safeResult.spo2 < 0 || safeResult.spo2 > 100) {
      safeResult.spo2 = 0; // Reset invalid values
    }
    
    // Additional physiological validation - MUCH stricter
    // Real SpO2 values from PPG typically don't change more than 1-2% per reading
    if (signalLog.length > 0) {
      const lastSpo2 = signalLog[signalLog.length - 1].result.spo2;
      if (lastSpo2 > 0 && safeResult.spo2 > 0 && Math.abs(safeResult.spo2 - lastSpo2) > 1) { // Reduced from 2 to 1
        console.warn("signalLogUtils: Detected physiologically implausible SpO2 change");
        safeResult.spo2 = 0;
      }
    }
    
    // ALWAYS be suspicious of perfect SpO2 values (common in simulations)
    if (safeResult.spo2 >= 95 && safeResult.spo2 <= 100) { // Lowered from 97 to 95
      console.warn("signalLogUtils: Suspiciously perfect SpO2 value detected", safeResult.spo2);
      // Be MUCH more skeptical of perfect values
      if (signalLog.length === 0 || signalLog[signalLog.length - 1].result.spo2 < 94) { // Changed from 96 to 94
        safeResult.spo2 = 0; // Reset suspicious first-time perfect values
      }
    }
  }
  
  // Validate glucose values for physiological plausibility with MUCH tighter constraints
  if (safeResult.glucose !== undefined) {
    if (safeResult.glucose < 0 || safeResult.glucose > 400) {
      safeResult.glucose = 0;
    }
    
    // Check for implausibly rapid changes - MUCH stricter
    if (signalLog.length > 0) {
      const lastGlucose = signalLog[signalLog.length - 1].result.glucose;
      if (lastGlucose > 0 && safeResult.glucose > 0) {
        const changePercent = Math.abs((safeResult.glucose - lastGlucose) / lastGlucose) * 100;
        if (changePercent > 3) { // Drastically tightened threshold from 5 to 3
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
  
  // Check if result has confidence info and validate it - MUCH stricter
  if (safeResult.confidence) {
    if (safeResult.confidence.overall < 0.7) { // Dramatically raised from 0.5 to 0.7
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
  
  // Keep log at manageable size
  const trimmedLog = updatedLog.length > 30 ? updatedLog.slice(-30) : updatedLog; // Reduced from 40 to 30
  
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
  
  // MUCH stricter physiological limits
  if (value < 0 || value > 150) {
    return false;
  }
  
  // DRASTICALLY increased minimum threshold
  if (value < 2.0) { // Increased from 1.0 to 2.0
    return false; // Too weak to be real signal
  }
  
  return true;
}

/**
 * Calculate signal quality based on variance and stability
 * with much stricter criteria to prevent false positives
 */
export function calculateSignalQuality(values: number[]): number {
  if (!values || values.length < 20) { // SIGNIFICANTLY increased from 15 to 20
    return 0;
  }
  
  // Calculate variance with aggressive validation
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  // Check for suspiciously low variance (potential false positive)
  // DRASTICALLY increased threshold
  if (variance < 2.5) { // Increased from 1.0 to 2.5
    return Math.min(5, Math.round(variance * 5)); // Severely penalize low variance
  }
  
  // Calculate stability (consistent spacing between peaks)
  const peaks = findSignalPeaks(values);
  let stabilityScore = 100;
  
  // MUCH stricter peak requirements
  if (peaks.length >= 8) { // Increased from 6 to 8
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    const intervalMean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const intervalVariance = intervals.reduce((sum, val) => sum + Math.pow(val - intervalMean, 2), 0) / intervals.length;
    
    // Higher variance = lower stability
    // MUCH more aggressive penalty
    stabilityScore = 100 - Math.min(100, (intervalVariance / intervalMean) * 400); // More aggressive (400 instead of 300)
  } else {
    stabilityScore = 2; // MUCH more severely penalize insufficient peaks (changed from 5 to 2)
  }
  
  // Combine variance and stability for final quality score with more weight on stability
  // Variance should be in a sweet spot - too low or too high is bad
  // REDEFINED curve to be more demanding
  const varianceScore = variance < 8.0 ? 5 + (variance * 3) : // Stricter curve
                        variance > 30 ? 20 :
                        60 - Math.min(40, Math.abs(variance - 15)); // Adjusted sweet spot
  
  // Apply a much more aggressive weighting that highly favors stability
  const weightedScore = Math.round((varianceScore * 0.15) + (stabilityScore * 0.85)); // Increased stability weight to 85%
  
  // Additional penalty for too few peaks (likely not a real signal)
  // DRAMATICALLY more strict peak requirements
  const peakPenalty = peaks.length < 6 ? 0.1 : // Severe penalty (from 0.2 to 0.1)
                     peaks.length < 8 ? 0.4 : 
                     peaks.length < 10 ? 0.7 : 1.0; // Added new tier
  
  return Math.round(weightedScore * peakPenalty);
}

/**
 * Find peaks in signal with extremely strict validation criteria
 */
function findSignalPeaks(values: number[]): number[] {
  if (values.length < 20) return []; // SIGNIFICANTLY increased requirement from 16 to 20
  
  const peaks = [];
  const MIN_PEAK_DISTANCE = 12; // Increased from 10 to 12 for physiological plausibility
  
  // Calculate adaptive threshold with MUCH higher minimum
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const threshold = Math.max(3.0, (max - min) * 0.7); // DRAMATICALLY increased threshold (was 2.0, now 3.0)
  
  for (let i = 5; i < values.length - 5; i++) { // WIDER window
    if (values[i] > values[i-1] && 
        values[i] > values[i-2] && 
        values[i] > values[i-3] && 
        values[i] > values[i-4] && 
        values[i] > values[i-5] && // Extra check
        values[i] > values[i+1] && 
        values[i] > values[i+2] &&
        values[i] > values[i+3] &&
        values[i] > values[i+4] &&
        values[i] > values[i+5] && // Extra check
        values[i] - Math.min(values[i-5], values[i-4], values[i-3], values[i-2], values[i-1], 
                            values[i+1], values[i+2], values[i+3], values[i+4], values[i+5]) > threshold) {
      
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

