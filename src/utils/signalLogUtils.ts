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
  // Input validation for medical-grade reliability
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
  
  // Only log each X signals to prevent memory issues
  // Reduced frequency to ensure we don't miss important signals
  if (processedSignals % 10 !== 0) {
    return signalLog;
  }
  
  // Deep clone result to prevent reference issues
  const safeResult = {...result};
  
  // Validate specific result fields
  if (safeResult.spo2 !== undefined) {
    // SpO2 must be between 0-100
    if (safeResult.spo2 < 0 || safeResult.spo2 > 100) {
      safeResult.spo2 = 0; // Reset invalid values
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
    dataValidated: true
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
  
  // Check physiological limits
  if (value < 0 || value > 255) {
    return false;
  }
  
  return true;
}

/**
 * Calculate signal quality based on variance and stability
 * to detect potential false positives
 */
export function calculateSignalQuality(values: number[]): number {
  if (!values || values.length < 10) {
    return 0;
  }
  
  // Calculate variance
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
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
    stabilityScore = 100 - Math.min(100, (intervalVariance / intervalMean) * 100);
  } else {
    stabilityScore = 30; // Not enough peaks for good stability measurement
  }
  
  // Combine variance and stability for final quality score
  // Variance should be in a sweet spot - too low or too high is bad
  const varianceScore = variance < 0.5 ? 30 : 
                        variance > 100 ? 50 :
                        100 - Math.min(100, Math.abs(variance - 20) * 2);
  
  return Math.round((varianceScore * 0.6) + (stabilityScore * 0.4));
}

/**
 * Find peaks in signal with strict validation
 */
function findSignalPeaks(values: number[]): number[] {
  if (values.length < 10) return [];
  
  const peaks = [];
  const MIN_PEAK_DISTANCE = 5;
  
  // Calculate adaptive threshold
  const max = Math.max(...values);
  const min = Math.min(...values);
  const threshold = (max - min) * 0.3; // 30% of range
  
  for (let i = 2; i < values.length - 2; i++) {
    if (values[i] > values[i-1] && 
        values[i] > values[i-2] && 
        values[i] > values[i+1] && 
        values[i] > values[i+2] &&
        values[i] - Math.min(values[i-2], values[i+1]) > threshold) {
      
      // Check if this peak is far enough from previous peak
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= MIN_PEAK_DISTANCE) {
        peaks.push(i);
      }
    }
  }
  
  return peaks;
}
