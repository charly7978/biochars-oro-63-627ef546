
/**
 * Functions for peak detection logic
 */

/**
 * Determines if a measurement should be processed based on signal strength
 */
export function shouldProcessMeasurement(value: number): boolean {
  // More sensitive threshold to capture real signals while filtering noise
  return Math.abs(value) >= 0.03;
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
 * Handle peak detection with improved natural synchronization
 */
export function handlePeakDetection(
  result: any, 
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestBeepCallback: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void {
  const now = Date.now();
  
  // More sensitive confidence threshold for natural peak detection
  if (result.isPeak && result.confidence > 0.25) {
    // Update peak time for timing calculations
    lastPeakTimeRef.current = now;
    
    // Only trigger beep for higher confidence peaks
    // Using natural timing with the actual detected peak
    if (isMonitoringRef.current && result.confidence > 0.3) {
      // Scale beep volume based on signal strength for more natural feel
      const beepVolume = Math.min(Math.abs(value * 1.2), 1.0);
      requestBeepCallback(beepVolume);
    }
  }
}
