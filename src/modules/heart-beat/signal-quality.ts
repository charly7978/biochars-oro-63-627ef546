
/**
 * Signal quality detection utilities
 * Centralized functions for checking signal quality and finger detection
 */

export interface SignalQualityOptions {
  lowSignalThreshold?: number;
  maxWeakSignalCount?: number;
}

/**
 * Checks if the current signal value indicates weak signal
 */
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
 * This function is imported and used by HeartBeatProcessor.js
 */
export function resetDetectionStates(): void {
  // Reset internal signal quality detection states
  console.log("Signal quality: reset detection states");
  // In a real implementation, this might reset various internal state variables
}

/**
 * Detects finger presence by analyzing rhythmic patterns in the signal
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

/**
 * Calculate signal quality index from 0-100
 */
export function calculateSignalQualityIndex(
  values: number[],
  windowSize: number = 20
): number {
  if (values.length < windowSize / 2) {
    return 0;
  }
  
  // Use the most recent values
  const recentValues = values.slice(-windowSize);
  
  // Calculate signal range
  const min = Math.min(...recentValues);
  const max = Math.max(...recentValues);
  const range = max - min;
  
  // Calculate signal noise (average of absolute differences)
  let noise = 0;
  for (let i = 1; i < recentValues.length; i++) {
    noise += Math.abs(recentValues[i] - recentValues[i-1]);
  }
  noise /= (recentValues.length - 1);
  
  // Calculate signal-to-noise ratio
  const snr = range / (noise + 0.001); // Avoid division by zero
  
  // Convert to 0-100 scale with reasonable scaling
  return Math.min(100, Math.max(0, snr * 15));
}

/**
 * Get channel feedback for improving detection
 */
export function getChannelFeedback(channelName: string): {
  available: boolean;
  quality: number;
  value: number;
} {
  // This would normally retrieve data from other channels
  // For now, return a default implementation
  return {
    available: false,
    quality: 0,
    value: 0
  };
}
