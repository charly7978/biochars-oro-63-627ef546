
/**
 * Module for peak detection in PPG signals
 */

/**
 * Handle peak detection and trigger appropriate responses
 * @param result Current signal processing result
 * @param lastPeakTimeRef Reference to the last peak time
 * @param requestImmediateBeep Function to request a beep
 * @param isMonitoringRef Reference to monitoring state
 * @param value Current signal value
 */
export const handlePeakDetection = (
  result: any,
  lastPeakTimeRef: React.MutableRefObject<number | null>,
  requestImmediateBeep: (value: number) => boolean,
  isMonitoringRef: React.MutableRefObject<boolean>,
  value: number
): void => {
  const isPeak = result.isPeak;
  
  // Update peak reference if this is a peak
  if (isPeak) {
    const now = Date.now();
    lastPeakTimeRef.current = now;
    
    // Request beep if monitoring
    if (isMonitoringRef.current) {
      // Higher value = louder beep
      const beepVolume = Math.min(0.8, Math.abs(value) * 2);
      requestImmediateBeep(beepVolume);
    }
  }
};

/**
 * Utility to check if we should adjust arrhythmia detection
 * based on confidence and historical values
 */
export const shouldAdjustArrhythmiaDetection = (
  confidence: number,
  bpm: number
): boolean => {
  // Only enable arrhythmia detection with reasonable confidence
  // and physiologically plausible values
  return confidence > 0.4 && bpm >= 40 && bpm <= 180;
};

/**
 * Process arrhythmia data for visualization
 * @param isArrhythmia Current arrhythmia status
 * @param currentTime Current timestamp
 * @param addArrhythmiaWindow Function to add visualization window
 */
export const processArrhythmiaVisualization = (
  isArrhythmia: boolean,
  currentTime: number,
  addArrhythmiaWindow: (start: number, end: number) => void
): void => {
  if (isArrhythmia) {
    // Create visualization window around the detected arrhythmia
    const windowStart = currentTime - 500;
    const windowEnd = currentTime + 500;
    addArrhythmiaWindow(windowStart, windowEnd);
  }
};
