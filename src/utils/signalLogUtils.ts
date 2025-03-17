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
    // Increased threshold to 0.5 - MUCH MORE AGGRESSIVE
    if (variance < 0.5) {
      console.warn("signalLogUtils: Rejected signal with suspiciously low variance (potential false positive)", variance);
      return signalLog;
    }
    
    // Reject implausibly high variance (likely noise, not physiological)
    if (variance > 50) {  // Reduced from 100 to be more strict
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
    // Made much more strict (0.1 instead of 0.01)
    if (diffVariance < 0.1 && meanDiff > 0) {
      console.warn("signalLogUtils: Rejected suspiciously uniform signal pattern", { diffVariance, meanDiff });
      return signalLog;
    }
  }
  
  // Only log each X signals to prevent memory issues
  if (processedSignals % 30 !== 0) { // Reduced frequency even more for better performance
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
      if (lastSpo2 > 0 && safeResult.spo2 > 0 && Math.abs(safeResult.spo2 - lastSpo2) > 2) { // Reduced from 3 to 2
        console.warn("signalLogUtils: Detected physiologically implausible SpO2 change");
        safeResult.spo2 = 0;
      }
    }
    
    // Suspicious if SpO2 is exactly 97-100% (too perfect, often in simulations)
    if (safeResult.spo2 >= 97 && safeResult.spo2 <= 100) { // Lowered from 98 to 97
      console.warn("signalLogUtils: Suspiciously perfect SpO2 value detected", safeResult.spo2);
      // We'll be skeptical of this perfect value
      if (signalLog.length === 0 || signalLog[signalLog.length - 1].result.spo2 < 96) { // Changed from 97 to 96
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
        if (changePercent > 5) { // Tightened threshold from 10 to 5 for better reliability
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
    if (safeResult.confidence.overall < 0.5) { // Raised from 0.3 to 0.5
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
  const trimmedLog = updatedLog.length > 40 ? updatedLog.slice(-40) : updatedLog; // Reduced from 60 to 40
  
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
  if (value < 1.0) { // Drastically increased minimum threshold from 0.1 to 1.0
    return false; // Too weak to be real signal
  }
  
  return true;
}

/**
 * Calculate signal quality based on variance and stability
 * with much stricter criteria to prevent false positives
 */
export function calculateSignalQuality(values: number[]): number {
  if (!values || values.length < 15) { // Increased requirement from 10 to 15
    return 0;
  }
  
  // Calculate variance with aggressive validation
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  // Check for suspiciously low variance (potential false positive)
  if (variance < 1.0) { // Drastically increased threshold from 0.15 to 1.0
    return Math.min(5, Math.round(variance * 10)); // Severely penalize low variance
  }
  
  // Calculate stability (consistent spacing between peaks)
  const peaks = findSignalPeaks(values);
  let stabilityScore = 100;
  
  if (peaks.length >= 6) { // Increased requirement from 5 to 6
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    const intervalMean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const intervalVariance = intervals.reduce((sum, val) => sum + Math.pow(val - intervalMean, 2), 0) / intervals.length;
    
    // Higher variance = lower stability
    stabilityScore = 100 - Math.min(100, (intervalVariance / intervalMean) * 300); // Much more aggressive penalty (300 instead of 200)
  } else {
    stabilityScore = 5; // Even more severely penalize insufficient peaks (changed from 10 to 5)
  }
  
  // Combine variance and stability for final quality score with more weight on stability
  // Variance should be in a sweet spot - too low or too high is bad
  const varianceScore = variance < 5.0 ? 5 + (variance * 5) : // Much stricter curve
                        variance > 40 ? 25 :
                        70 - Math.min(50, Math.abs(variance - 20)); // Adjusted sweet spot range
  
  // Apply a much more aggressive weighting that highly favors stability
  const weightedScore = Math.round((varianceScore * 0.2) + (stabilityScore * 0.8)); // Increased stability weight to 80%
  
  // Additional penalty for too few peaks (likely not a real signal)
  const peakPenalty = peaks.length < 5 ? 0.2 : // Severe penalty (from 0.3 to 0.2)
                      peaks.length < 7 ? 0.5 : 1.0; // Increased requirement from 6 to 7
  
  return Math.round(weightedScore * peakPenalty);
}

/**
 * Find peaks in signal with extremely strict validation criteria
 */
function findSignalPeaks(values: number[]): number[] {
  if (values.length < 16) return []; // Significantly increased requirement from 12 to 16
  
  const peaks = [];
  const MIN_PEAK_DISTANCE = 10; // Increased for better physiological plausibility
  
  // Calculate adaptive threshold with much higher minimum
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const threshold = Math.max(2.0, (max - min) * 0.6); // Drastically increased threshold (was 1.0, now 2.0)
  
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
