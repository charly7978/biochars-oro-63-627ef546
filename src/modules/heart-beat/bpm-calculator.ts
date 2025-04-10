
/**
 * Functions for calculating and managing heart rate (BPM)
 */

/**
 * Updates BPM history based on new peak detection
 */
export function updateBPMHistory(
  lastPeakTime: number,
  previousPeakTime: number | null,
  bpmHistory: number[],
  config: {
    minBPM: number,
    maxBPM: number,
    maxHistoryLength: number
  }
): number[] {
  if (!previousPeakTime) return bpmHistory;
  
  const interval = lastPeakTime - previousPeakTime;
  if (interval <= 0) return bpmHistory;

  const instantBPM = 60000 / interval;
  
  // Validate physiological range
  if (instantBPM >= config.minBPM && instantBPM <= config.maxBPM) {
    const updatedHistory = [...bpmHistory, instantBPM];
    
    // Maintain history size limit
    if (updatedHistory.length > config.maxHistoryLength) {
      return updatedHistory.slice(-config.maxHistoryLength);
    }
    
    return updatedHistory;
  }
  
  return bpmHistory;
}

/**
 * Calculates current BPM with outlier rejection
 */
export function calculateCurrentBPM(bpmHistory: number[]): number {
  if (bpmHistory.length < 2) {
    return 0;
  }
  
  // Handle basic case with just two values
  if (bpmHistory.length === 2) {
    return (bpmHistory[0] + bpmHistory[1]) / 2;
  }
  
  // Sort to find median for outlier detection
  const sorted = [...bpmHistory].sort((a, b) => a - b);
  
  // Trimming extreme values for robustness
  const trimmed = sorted.slice(1, -1);
  if (!trimmed.length) return 0;
  
  // Average of remaining values
  const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  return avg;
}

/**
 * Applies smoothing to BPM value using exponential moving average
 */
export function smoothBPM(currentBPM: number, previousSmoothedBPM: number, alpha: number): number {
  if (previousSmoothedBPM === 0) {
    return currentBPM;
  }
  
  return alpha * currentBPM + (1 - alpha) * previousSmoothedBPM;
}

/**
 * Calculates final BPM with statistical trimming
 */
export function calculateFinalBPM(bpmHistory: number[]): number {
  if (bpmHistory.length < 5) {
    return 0;
  }
  
  const sorted = [...bpmHistory].sort((a, b) => a - b);
  const cut = Math.round(sorted.length * 0.1);
  const finalSet = sorted.slice(cut, sorted.length - cut);
  
  if (!finalSet.length) return 0;
  
  const sum = finalSet.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / finalSet.length);
}
