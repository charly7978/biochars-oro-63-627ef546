
/**
 * Functions for peak detection logic
 * Severely restricted to prevent false positives
 */

/**
 * Determines if a measurement should be processed based on signal strength
 * Drastically increased thresholds
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Much higher threshold to prevent processing weak signals (likely noise)
  return Math.abs(value) >= 0.40; // Drastically increased from 0.05
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
 * Handle peak detection
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // Only process peaks with much higher confidence (prevents false positives)
  if (result.isPeak && result.confidence > 0.65) { // Drastically increased threshold
    lastPeakTimeRef.current = now;
    
    if (isMonitoringRef.current && result.confidence > 0.70) { // Higher beep threshold too
      requestBeepCallback(value);
    }
  }
}
