/**
 * Utilities for BPM (beats per minute) calculation
 */

/**
 * Update the BPM history with a new interval
 * 
 * @param bpmHistory Array of recent BPM values
 * @param interval New RR interval in milliseconds
 * @param minBpm Minimum physiologically valid BPM
 * @param maxBpm Maximum physiologically valid BPM
 * @returns Updated BPM history array
 */
export function updateBPMHistory(
  bpmHistory: number[],
  interval: number,
  minBpm: number = 40,
  maxBpm: number = 200
): number[] {
  // Convert interval to BPM
  const instantBPM = 60000 / interval;
  
  // Only add valid BPM values
  if (instantBPM >= minBpm && instantBPM <= maxBpm) {
    const updatedHistory = [...bpmHistory, instantBPM];
    
    // Keep a reasonable history size
    if (updatedHistory.length > 12) {
      return updatedHistory.slice(-12);
    }
    
    return updatedHistory;
  }
  
  return bpmHistory;
}

/**
 * Calculate current BPM from history
 * 
 * @param bpmHistory Array of recent BPM values
 * @returns Current BPM or 0 if insufficient data
 */
export function calculateCurrentBPM(bpmHistory: number[]): number {
  if (bpmHistory.length < 2) {
    return 0;
  }
  
  // Sort the history and trim outliers
  const sorted = [...bpmHistory].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  
  if (trimmed.length === 0) {
    return bpmHistory[bpmHistory.length - 1];
  }
  
  // Calculate average of trimmed values
  const sum = trimmed.reduce((a, b) => a + b, 0);
  return sum / trimmed.length;
}

/**
 * Apply smoothing to BPM
 * 
 * @param currentBPM Current calculated BPM
 * @param smoothedBPM Previous smoothed BPM
 * @param alpha Weight factor for smoothing (0-1)
 * @returns Smoothed BPM
 */
export function smoothBPM(currentBPM: number, smoothedBPM: number, alpha: number = 0.2): number {
  if (smoothedBPM === 0) {
    return currentBPM;
  }
  
  return alpha * currentBPM + (1 - alpha) * smoothedBPM;
}

/**
 * Calculate final BPM with additional filtering
 * 
 * @param bpmHistory Complete BPM history
 * @returns Final filtered BPM or 0 if insufficient data
 */
export function calculateFinalBPM(bpmHistory: number[]): number {
  if (bpmHistory.length < 5) {
    return 0;
  }
  
  // Sort and trim outliers using percentile method
  const sorted = [...bpmHistory].sort((a, b) => a - b);
  const cutPercentage = 0.1; // Trim 10% from each end
  const cut = Math.round(sorted.length * cutPercentage);
  const finalSet = sorted.slice(cut, sorted.length - cut);
  
  if (finalSet.length === 0) {
    return 0;
  }
  
  // Calculate average
  const sum = finalSet.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / finalSet.length);
}
