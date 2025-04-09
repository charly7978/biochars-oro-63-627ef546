
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
 * Reset all detection states for signal quality
 */
export function resetDetectionStates() {
  return {
    weakSignalsCount: 0,
    lastDetectionTime: 0
  };
}

/**
 * Check for rhythmic pattern in signal history to detect finger presence
 * @param signalHistory Array of signal measurements with timestamps
 * @param patternCount Current count of detected patterns
 * @returns Updated pattern detection status
 */
export function isFingerDetectedByPattern(
  signalHistory: Array<{time: number, value: number}>, 
  patternCount: number
): { isFingerDetected: boolean, patternCount: number } {
  // Default to current count if not enough data
  if (signalHistory.length < 15) {
    return { isFingerDetected: false, patternCount };
  }
  
  // Simple peak detection in recent history
  const recentValues = signalHistory.slice(-15).map(point => point.value);
  let peaks = 0;
  
  for (let i = 1; i < recentValues.length - 1; i++) {
    if (recentValues[i] > recentValues[i-1] && recentValues[i] > recentValues[i+1]) {
      peaks++;
    }
  }
  
  // Check if pattern suggests finger presence (2-3 peaks in window is normal heart rate)
  const hasPattern = peaks >= 2 && peaks <= 5;
  const newPatternCount = hasPattern ? patternCount + 1 : Math.max(0, patternCount - 1);
  
  // Require consistent pattern detection
  return {
    isFingerDetected: newPatternCount >= 3,
    patternCount: newPatternCount
  };
}
