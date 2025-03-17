
/**
 * Enhanced peak detection utilities for PPG signals
 * Extracted from SignalProcessor for better maintainability
 */

/**
 * Enhanced peak detection with stricter criteria for better accuracy
 */
export function findPeaksEnhanced(values: number[]): number[] {
  const peaks: number[] = [];
  const minPeakDistance = 12; // Increased minimum samples between peaks
  
  // Calculate mean and standard deviation
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  );
  
  // Dynamic threshold based on signal statistics - more strict
  const peakThreshold = mean + (stdDev * 0.7); // Increased from 0.5
  
  // First pass: find potential peaks
  const potentialPeaks = [];
  for (let i = 3; i < values.length - 3; i++) { // Check wider window
    const current = values[i];
    
    // Check if this point is higher than neighbors and above threshold
    if (current > values[i - 1] && 
        current > values[i - 2] &&
        current > values[i - 3] &&
        current > values[i + 1] && 
        current > values[i + 2] &&
        current > values[i + 3] &&
        current > peakThreshold) {
      
      potentialPeaks.push(i);
    }
  }
  
  // Second pass: filter peaks by prominence and distance
  for (let i = 0; i < potentialPeaks.length; i++) {
    const peakIdx = potentialPeaks[i];
    const peakValue = values[peakIdx];
    
    // Find nearest valleys to calculate prominence
    let leftValley = mean;
    for (let j = peakIdx - 1; j >= 0; j--) {
      if (values[j] <= values[j + 1]) {
        leftValley = values[j];
        break;
      }
    }
    
    let rightValley = mean;
    for (let j = peakIdx + 1; j < values.length; j++) {
      if (values[j] <= values[j - 1]) {
        rightValley = values[j];
        break;
      }
    }
    
    // Calculate prominence (minimum height above surrounding valleys)
    const prominence = Math.min(peakValue - leftValley, peakValue - rightValley);
    
    // Only accept peaks with sufficient prominence
    if (prominence > stdDev * 0.5) {
      // Check distance from other accepted peaks
      const isFarEnough = peaks.every(p => Math.abs(peakIdx - p) >= minPeakDistance);
      
      if (isFarEnough) {
        peaks.push(peakIdx);
      }
    }
  }
  
  return peaks.sort((a, b) => a - b);
}

/**
 * Calculate heart rate from PPG values
 */
export function calculateHeartRate(ppgValues: number[], sampleRate: number = 30): number {
  if (ppgValues.length < sampleRate * 3) { // Need at least 3 seconds
    return 0;
  }
  
  // Get recent data (last 6 seconds)
  const recentData = ppgValues.slice(-Math.min(ppgValues.length, sampleRate * 6));
  
  // Find peaks with stricter criteria
  const peaks = findPeaksEnhanced(recentData);
  
  if (peaks.length < 3) { // Require at least 3 peaks
    return 0;
  }
  
  // Calculate average interval between peaks
  let totalInterval = 0;
  for (let i = 1; i < peaks.length; i++) {
    totalInterval += peaks[i] - peaks[i - 1];
  }
  
  const avgInterval = totalInterval / (peaks.length - 1);
  
  // Convert to beats per minute
  // interval is in samples, so divide by sample rate to get seconds
  // then convert to minutes (60 seconds/minute)
  return Math.round(60 / (avgInterval / sampleRate));
}
