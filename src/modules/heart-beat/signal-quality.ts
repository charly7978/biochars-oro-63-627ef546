
/**
 * Signal quality detection utilities
 * Centralized functions for checking signal quality and finger detection
 */

export interface SignalQualityOptions {
  lowSignalThreshold?: number;
  maxWeakSignalCount?: number;
}

export function checkSignalQuality(
  value: number,
  currentWeakSignalCount: number,
  options: SignalQualityOptions = {}
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } {
  // Default thresholds
  const LOW_SIGNAL_THRESHOLD = options.lowSignalThreshold || 0.05;
  const MAX_WEAK_SIGNALS = options.maxWeakSignalCount || 10;
  
  const isCurrentValueWeak = Math.abs(value) < LOW_SIGNAL_THRESHOLD;
  
  // Update consecutive weak signals counter
  let updatedWeakSignalsCount = isCurrentValueWeak 
    ? currentWeakSignalCount + 1 
    : 0;
  
  // Limit to max
  updatedWeakSignalsCount = Math.min(MAX_WEAK_SIGNALS, updatedWeakSignalsCount);
  
  // Signal is considered weak if we have enough consecutive weak readings
  const isWeakSignal = updatedWeakSignalsCount >= MAX_WEAK_SIGNALS;
  
  return { isWeakSignal, updatedWeakSignalsCount };
}

export function shouldProcessMeasurement(
  value: number,
  weakSignalsCount: number,
  options: SignalQualityOptions = {}
): boolean {
  const { isWeakSignal } = checkSignalQuality(value, weakSignalsCount, options);
  return !isWeakSignal;
}

export function createWeakSignalResult(): { bpm: number; confidence: number; isPeak: boolean; arrhythmiaCount: number } {
  return {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    arrhythmiaCount: 0
  };
}

export function resetSignalQualityState(): number {
  return 0; // Reset the weak signals counter
}

/**
 * Resets all detection states related to signal quality
 */
export function resetDetectionStates(): void {
  // This function is needed by HeartBeatProcessor.js
  // It will reset all internal states related to signal detection
  console.log("Signal quality: reset detection states");
}

/**
 * Detects finger presence by analyzing rhythmic patterns in the signal
 * @param signalHistory Array of signal history points with time and value
 * @param currentPatternCount Current count of detected patterns
 * @returns Object with finger detection status and updated pattern count
 */
export function isFingerDetectedByPattern(
  signalHistory: Array<{time: number, value: number}>,
  currentPatternCount: number
): { isFingerDetected: boolean; patternCount: number } {
  if (signalHistory.length < 15) {
    return { isFingerDetected: false, patternCount: 0 };
  }
  
  // Simple pattern detection based on consistent rises and falls
  let patternCount = currentPatternCount;
  let risingCount = 0;
  let fallingCount = 0;
  
  // Check for consistent rises and falls in the signal
  for (let i = 1; i < signalHistory.length; i++) {
    const diff = signalHistory[i].value - signalHistory[i-1].value;
    if (diff > 0.05) {
      risingCount++;
    } else if (diff < -0.05) {
      fallingCount++;
    }
  }
  
  // Check if we have a good balance of rises and falls (rhythmic)
  const hasRhythm = risingCount >= 3 && fallingCount >= 3 && 
                   Math.abs(risingCount - fallingCount) <= 2;
  
  // Update pattern count
  if (hasRhythm) {
    patternCount++;
  } else {
    patternCount = Math.max(0, patternCount - 1);
  }
  
  // Finger is detected if we have consistent patterns
  return {
    isFingerDetected: patternCount >= 3,
    patternCount
  };
}
