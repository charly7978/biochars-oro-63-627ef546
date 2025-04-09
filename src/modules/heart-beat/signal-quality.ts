
/**
 * Signal quality check utility function
 */
import { SignalQualityParams } from "../../hooks/vital-signs/types";

/**
 * Check if a PPG signal is too weak or unusable
 * @param value PPG signal value
 * @param currentWeakCount Current count of consecutive weak signals
 * @param params Signal quality parameters
 * @returns Result with signal status and updated weak signals count
 */
export function checkSignalQuality(
  value: number,
  currentWeakCount: number,
  params: SignalQualityParams
) {
  const { lowSignalThreshold, maxWeakSignalCount } = params;
  
  // Check if signal is too weak
  const isCurrentSignalWeak = Math.abs(value) < lowSignalThreshold;
  
  let updatedWeakSignalsCount = isCurrentSignalWeak 
    ? currentWeakCount + 1 
    : Math.max(0, currentWeakCount - 0.5);
  
  // Consider signal weak if we've had too many consecutive weak readings
  const isWeakSignal = updatedWeakSignalsCount >= maxWeakSignalCount;
  
  return {
    isWeakSignal,
    updatedWeakSignalsCount
  };
}

/**
 * Check if finger is detected based on signal patterns
 * @param signalHistory Recent signal history with timestamps
 * @param currentPatternCount Current detection count
 * @returns Updated detection status
 */
export function isFingerDetectedByPattern(
  signalHistory: Array<{time: number, value: number}>,
  currentPatternCount: number
): { isFingerDetected: boolean, patternCount: number } {
  // Need at least 3 seconds of data
  if (signalHistory.length < 30) {
    return { isFingerDetected: false, patternCount: 0 };
  }
  
  // Look for rhythmic patterns in the signal
  // Simple peak detection for demonstration
  const peaks = [];
  for (let i = 1; i < signalHistory.length - 1; i++) {
    if (signalHistory[i].value > signalHistory[i-1].value && 
        signalHistory[i].value > signalHistory[i+1].value &&
        signalHistory[i].value > 0.2) {
      peaks.push(signalHistory[i].time);
    }
  }
  
  // Check if we have at least 3 peaks
  if (peaks.length >= 3) {
    // Calculate intervals between peaks
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Check if intervals are consistent (physiological heart rate)
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const isConsistent = intervals.every(interval => 
      Math.abs(interval - avgInterval) / avgInterval < 0.3 && // 30% variance allowed
      interval > 500 && interval < 1500 // 40-120 BPM range (500-1500ms)
    );
    
    if (isConsistent) {
      const newPatternCount = currentPatternCount + 1;
      return {
        isFingerDetected: newPatternCount >= 3,
        patternCount: newPatternCount
      };
    }
  }
  
  // Reduce pattern count if no consistent pattern found
  return {
    isFingerDetected: false,
    patternCount: Math.max(0, currentPatternCount - 1)
  };
}

/**
 * Reset detection states for signal quality
 * This is used by the HeartBeatProcessor to reset state when needed
 * @returns Reset state object with zeroed counters
 */
export function resetDetectionStates() {
  console.log("Signal quality: Resetting detection states");
  return {
    weakSignalsCount: 0
  };
}
