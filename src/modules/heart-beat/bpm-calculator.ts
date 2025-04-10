/**
 * BPM calculation utilities for heart rate detection
 */

/**
 * Update BPM history with new value
 * 
 * @param bpmHistory Array of recent BPM values
 * @param newBPM New BPM value to add
 * @param maxSize Maximum history size
 * @param minBPM Minimum valid BPM
 * @param maxBPM Maximum valid BPM
 * @returns Updated BPM history
 */
export function updateBPMHistory(
  bpmHistory: number[], 
  newBPM: number, 
  maxSize: number = 10,
  minBPM: number = 40,
  maxBPM: number = 200
): number[] {
  // Validate BPM is within physiological range
  if (newBPM >= minBPM && newBPM <= maxBPM) {
    // Add to history
    const updatedHistory = [...bpmHistory, newBPM];
    
    // Trim if needed
    if (updatedHistory.length > maxSize) {
      return updatedHistory.slice(-maxSize);
    }
    
    return updatedHistory;
  }
  
  // Invalid BPM, return unchanged history
  return bpmHistory;
}

/**
 * Calculate current BPM from RR intervals
 * 
 * @param rrInterval RR interval in milliseconds
 * @returns BPM value
 */
export function calculateCurrentBPM(rrInterval: number): number {
  if (!rrInterval || rrInterval === 0) return 0;
  
  // Convert ms to BPM: 60000 ms / RR interval
  return 60000 / rrInterval;
}

/**
 * Apply exponential smoothing to BPM
 * 
 * @param currentBPM Current BPM
 * @param smoothBPM Previous smoothed BPM
 * @param alpha Smoothing factor (0-1)
 * @returns Smoothed BPM
 */
export function smoothBPM(currentBPM: number, smoothBPM: number, alpha: number = 0.3): number {
  // If no previous smooth value, use current
  if (smoothBPM === 0) {
    return currentBPM;
  }
  
  // Apply smoothing
  return alpha * currentBPM + (1 - alpha) * smoothBPM;
}

/**
 * Calculate final BPM with outlier rejection
 * 
 * @param bpmHistory Array of recent BPM values
 * @returns Final BPM value
 */
export function calculateFinalBPM(bpmHistory: number[]): number {
  if (bpmHistory.length < 3) {
    return 0;
  }
  
  // Sort values to remove outliers
  const sorted = [...bpmHistory].sort((a, b) => a - b);
  
  // Remove outliers (10% from each end)
  const trimSize = Math.max(1, Math.floor(sorted.length * 0.1));
  const trimmed = sorted.slice(trimSize, sorted.length - trimSize);
  
  // Calculate average of remaining values
  if (trimmed.length === 0) {
    return Math.round(sorted[Math.floor(sorted.length / 2)]);
  }
  
  const sum = trimmed.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / trimmed.length);
}

/**
 * Calculate confidence level based on BPM stability
 * 
 * @param bpmHistory Array of recent BPM values
 * @returns Confidence value (0-1)
 */
export function calculateBPMConfidence(bpmHistory: number[]): number {
  if (bpmHistory.length < 3) {
    return 0.1;
  }
  
  // Calculate variance
  const avg = bpmHistory.reduce((sum, val) => sum + val, 0) / bpmHistory.length;
  let variance = 0;
  
  for (const bpm of bpmHistory) {
    variance += Math.pow(bpm - avg, 2);
  }
  
  variance /= bpmHistory.length;
  
  // Higher variance = lower confidence
  const varianceComponent = Math.max(0, 1 - variance / 400);
  
  // More data points = higher confidence
  const sizeComponent = Math.min(1, bpmHistory.length / 8);
  
  return Math.min(1, (varianceComponent * 0.7) + (sizeComponent * 0.3));
}
