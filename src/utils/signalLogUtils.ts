
/**
 * Medical-grade utilities for signal logging and analysis
 * with strict validation requirements
 */

/**
 * Updates the signal log with strict validation, maintaining a manageable size
 * and preventing any simulated or invalid data
 */
export function updateSignalLog(
  signalLog: {timestamp: number, value: number, result: any}[],
  currentTime: number,
  value: number,
  result: any,
  processedSignals: number
): {timestamp: number, value: number, result: any}[] {
  // Enhanced input validation for medical-grade reliability
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
  
  // Additional strict validations to prevent false data
  if (value > 255) {
    console.warn("signalLogUtils: Rejected physiologically implausible signal value");
    return signalLog;
  }
  
  // Calculate signal quality based on variance and stability
  // to detect potential false positives in history
  if (signalLog.length > 5) {
    const recentValues = signalLog.slice(-5).map(entry => entry.value);
    const variance = calculateVariance(recentValues);
    
    // Extremely low variance could indicate false reading or no finger
    if (variance < 0.01) {
      console.warn("signalLogUtils: Rejected signal with suspiciously low variance (potential false positive)");
      return signalLog;
    }
  }
  
  // Only log each X signals to prevent memory issues
  // Reduced frequency to ensure we don't miss important signals
  if (processedSignals % 10 !== 0) {
    return signalLog;
  }
  
  // Deep clone result to prevent reference issues
  const safeResult = {...result};
  
  // Validate specific result fields with more aggressive thresholds
  if (safeResult.spo2 !== undefined) {
    // SpO2 must be between 0-100
    if (safeResult.spo2 < 0 || safeResult.spo2 > 100) {
      safeResult.spo2 = 0; // Reset invalid values
    }
    
    // Additional physiological validation
    // Real SpO2 values from PPG typically don't change more than 2-3% per reading
    if (signalLog.length > 0) {
      const lastSpo2 = signalLog[signalLog.length - 1].result.spo2;
      if (lastSpo2 > 0 && safeResult.spo2 > 0 && Math.abs(safeResult.spo2 - lastSpo2) > 4) {
        console.warn("signalLogUtils: Detected physiologically implausible SpO2 change");
        safeResult.spo2 = 0;
      }
    }
  }
  
  // Validate glucose values for physiological plausibility
  if (safeResult.glucose !== undefined) {
    if (safeResult.glucose < 0 || safeResult.glucose > 600) {
      safeResult.glucose = 0;
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
  
  // Keep log at manageable size but increased from 50 to 100 for better analysis
  const trimmedLog = updatedLog.length > 100 ? updatedLog.slice(-100) : updatedLog;
  
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
 * to prevent false data from being processed
 */
export function validateSignalValue(value: number): boolean {
  // Check for NaN or Infinity
  if (isNaN(value) || !isFinite(value)) {
    return false;
  }
  
  // Check basic physiological limits
  if (value < 0 || value > 255) {
    return false;
  }
  
  // Additional validation for implausible values
  if (value < 0.01) {
    return false; // Too weak to be real signal
  }
  
  return true;
}

/**
 * Calculate signal quality based on variance and stability
 * to detect potential false positives with much stricter criteria
 */
export function calculateSignalQuality(values: number[]): number {
  if (!values || values.length < 10) {
    return 0;
  }
  
  // Calculate variance with aggressive validation
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  // Check for suspiciously low variance (potential false positive)
  if (variance < 0.1) {
    return Math.min(30, Math.round(variance * 300)); // Severely penalize low variance
  }
  
  // Calculate stability (consistent spacing between peaks)
  const peaks = findSignalPeaks(values);
  let stabilityScore = 100;
  
  if (peaks.length >= 3) {
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    const intervalMean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const intervalVariance = intervals.reduce((sum, val) => sum + Math.pow(val - intervalMean, 2), 0) / intervals.length;
    
    // Higher variance = lower stability
    stabilityScore = 100 - Math.min(100, (intervalVariance / intervalMean) * 120); // More aggressive penalty
  } else {
    stabilityScore = 25; // Severely penalize insufficient peaks
  }
  
  // Combine variance and stability for final quality score with more weight on stability
  // Variance should be in a sweet spot - too low or too high is bad
  const varianceScore = variance < 1.0 ? 20 + (variance * 40) : 
                        variance > 100 ? 40 :
                        90 - Math.min(50, Math.abs(variance - 25));
  
  // Apply a more aggressive weighting that favors stability
  const weightedScore = Math.round((varianceScore * 0.4) + (stabilityScore * 0.6));
  
  // Additional penalty for too few peaks (likely not a real signal)
  const peakPenalty = peaks.length < 3 ? 0.7 : 1.0;
  
  return Math.round(weightedScore * peakPenalty);
}

/**
 * Find peaks in signal with much stricter validation
 */
function findSignalPeaks(values: number[]): number[] {
  if (values.length < 12) return []; // Require more data points
  
  const peaks = [];
  const MIN_PEAK_DISTANCE = 5;
  
  // Calculate adaptive threshold with higher minimum
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const threshold = Math.max(0.5, (max - min) * 0.4); // Increased threshold to 40% of range
  
  for (let i = 3; i < values.length - 3; i++) {
    if (values[i] > values[i-1] && 
        values[i] > values[i-2] && 
        values[i] > values[i-3] && 
        values[i] > values[i+1] && 
        values[i] > values[i+2] &&
        values[i] > values[i+3] &&
        values[i] - Math.min(values[i-3], values[i-2], values[i-1], values[i+1], values[i+2], values[i+3]) > threshold) {
      
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
