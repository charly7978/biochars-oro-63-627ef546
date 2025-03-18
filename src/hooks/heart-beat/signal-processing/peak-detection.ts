
/**
 * Functions for peak detection logic
 * Optimized to prevent false positives while enabling actual measurements
 */

/**
 * Determines if a measurement should be processed based on signal strength
 * Higher thresholds to prevent processing noise
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Higher threshold but not too high to prevent processing noise while allowing real signals
  return Math.abs(value) >= 0.30; // Balanced threshold
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
 * Handle peak detection with improved validation
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // Process peaks with higher confidence but not too high
  if (result.isPeak && result.confidence > 0.50) { // Balanced threshold
    lastPeakTimeRef.current = now;
    
    if (isMonitoringRef.current && result.confidence > 0.55) { // Higher beep threshold
      requestBeepCallback(value);
    }
  }
}

