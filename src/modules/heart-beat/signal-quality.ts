
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
 * Detect rhythmic patterns in signal history to identify finger presence
 * Returns count of detected patterns and whether finger is detected
 */
export function isFingerDetectedByPattern(
  signalHistory: Array<{time: number, value: number}>,
  currentPatternCount: number
): { patternCount: number, isFingerDetected: boolean } {
  // Implementation of pattern detection for finger presence
  if (signalHistory.length < 15) {
    return { patternCount: 0, isFingerDetected: false };
  }
  
  // Check for rhythmic pattern in the signal history
  let patternDetected = false;
  let patternStrength = 0;
  
  // Simple peak detection to find rhythmic patterns
  const peaks: number[] = [];
  for (let i = 2; i < signalHistory.length - 2; i++) {
    if (signalHistory[i].value > signalHistory[i-1].value && 
        signalHistory[i].value > signalHistory[i-2].value &&
        signalHistory[i].value > signalHistory[i+1].value && 
        signalHistory[i].value > signalHistory[i+2].value) {
      peaks.push(i);
    }
  }
  
  // Check if peaks show a rhythmic pattern
  if (peaks.length >= 3) {
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      const timeDiff = signalHistory[peaks[i]].time - signalHistory[peaks[i-1]].time;
      intervals.push(timeDiff);
    }
    
    // Calculate average and variance of intervals
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 0), 0) / intervals.length;
    
    // If variance is low, we have a rhythmic pattern
    if (variance < avgInterval * 0.3) {
      patternDetected = true;
      patternStrength = Math.min(1.0, 3 / variance);
    }
  }
  
  // Update pattern count
  let updatedPatternCount = currentPatternCount;
  if (patternDetected) {
    updatedPatternCount += 1;
  } else {
    updatedPatternCount = Math.max(0, updatedPatternCount - 0.5);
  }
  
  // Limit maximum count
  updatedPatternCount = Math.min(5, updatedPatternCount);
  
  // Consider finger detected if pattern count is high enough
  const isFingerDetected = updatedPatternCount >= 3;
  
  return {
    patternCount: updatedPatternCount,
    isFingerDetected
  };
}
