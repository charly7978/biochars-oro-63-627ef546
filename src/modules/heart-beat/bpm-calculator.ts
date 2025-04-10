
/**
 * BPM calculation utilities for heart rate processing
 * Handles the calculation and smoothing of heart rate from peak intervals
 */

/**
 * Updates the BPM history array with a new instantaneous BPM value
 * 
 * @param bpmHistory Array of recent BPM values
 * @param interval Time interval in ms between consecutive peaks
 * @param minBPM Minimum physiologically valid BPM
 * @param maxBPM Maximum physiologically valid BPM
 * @param maxHistoryLength Maximum number of BPM values to keep in history
 * @returns Updated BPM history array
 */
export function updateBPMHistory(
  bpmHistory: number[],
  interval: number,
  minBPM: number = 40,
  maxBPM: number = 200,
  maxHistoryLength: number = 12
): number[] {
  // Validate interval to prevent division by zero
  if (interval <= 0) return bpmHistory;
  
  // Calculate instantaneous BPM from interval
  const instantBPM = 60000 / interval;
  
  // Only add valid BPMs within physiological range
  if (instantBPM < minBPM || instantBPM > maxBPM) {
    return bpmHistory;
  }
  
  // Create a new history array with the new value
  const newHistory = [...bpmHistory, instantBPM];
  
  // Trim if too long
  if (newHistory.length > maxHistoryLength) {
    return newHistory.slice(-maxHistoryLength);
  }
  
  return newHistory;
}

/**
 * Calculates the current BPM from the history, with outlier removal
 * 
 * @param bpmHistory Array of recent BPM values
 * @returns Calculated current BPM or 0 if not enough data
 */
export function calculateCurrentBPM(bpmHistory: number[]): number {
  if (bpmHistory.length < 2) {
    return 0;
  }
  
  // Sort for outlier removal
  const sorted = [...bpmHistory].sort((a, b) => a - b);
  
  // Remove outliers (highest and lowest values)
  const trimmed = sorted.slice(1, -1);
  
  // Calculate average of remaining values
  if (trimmed.length === 0) return 0;
  
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

/**
 * Apply exponential smoothing to BPM value
 * 
 * @param currentBPM Current calculated BPM
 * @param previousSmoothedBPM Previous smoothed BPM value
 * @param alpha Smoothing factor (0-1)
 * @returns Smoothed BPM value
 */
export function smoothBPM(
  currentBPM: number,
  previousSmoothedBPM: number,
  alpha: number = 0.2
): number {
  // Initialize if first measurement
  if (previousSmoothedBPM === 0) {
    return currentBPM;
  }
  
  // Apply exponential smoothing
  return alpha * currentBPM + (1 - alpha) * previousSmoothedBPM;
}

/**
 * Calculate final BPM value for display, with more aggressive outlier removal
 * 
 * @param bpmHistory Array of recent BPM values
 * @returns Final BPM value for display or 0 if not enough data
 */
export function calculateFinalBPM(bpmHistory: number[]): number {
  // Need sufficient data for reliable calculation
  if (bpmHistory.length < 5) {
    return 0;
  }
  
  // Sort values
  const sorted = [...bpmHistory].sort((a, b) => a - b);
  
  // Cut 10% from each end to remove outliers
  const cut = Math.round(sorted.length * 0.1);
  const finalSet = sorted.slice(cut, sorted.length - cut);
  
  if (finalSet.length === 0) return 0;
  
  // Calculate average
  const sum = finalSet.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / finalSet.length);
}
