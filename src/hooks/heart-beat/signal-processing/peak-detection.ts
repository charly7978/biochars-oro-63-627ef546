
/**
 * Functions for peak detection logic
 */

/**
 * Determines if a measurement should be processed based on signal strength
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Don't process signals that are too small (likely noise)
  return Math.abs(value) >= 0.05;
}

/**
 * Creates default signal processing result when signal is too weak
 */
export function createWeakSignalResult(arrhythmiaCounter: number = 0): any {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: arrhythmiaCounter || 0,
    rrData: {
      intervals: [],
      lastPeakTime: null
    }
  };
}

/**
 * Updates the reference to last valid BPM when condition is met
 */
export function updateLastValidBpm(result: any, lastValidBpmRef: React.MutableRefObject<number>): void {
  if (result.bpm >= 40 && result.bpm <= 200) {
    lastValidBpmRef.current = result.bpm;
  }
}
