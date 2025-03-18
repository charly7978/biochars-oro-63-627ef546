
/**
 * Functions for checking signal quality and weak signals
 * Adjusted to be more responsive while maintaining accuracy
 */
import { checkSignalQuality } from '../../../modules/heart-beat/signal-quality';

/**
 * Checks if the signal is too weak, indicating possible finger removal
 * Modified to be more lenient to allow more beeps
 */
export function checkWeakSignal(
  value: number,
  consecutiveWeakSignalsCount: number,
  config: {
    lowSignalThreshold: number,
    maxWeakSignalCount: number
  }
): {
  isWeakSignal: boolean,
  updatedWeakSignalsCount: number
} {
  // Use less strict thresholds
  const finalConfig = {
    lowSignalThreshold: config.lowSignalThreshold || 0.25, // Reduced from 0.33
    maxWeakSignalCount: config.maxWeakSignalCount || 7    // Reduced from 8
  };
  
  return checkSignalQuality(value, consecutiveWeakSignalsCount, finalConfig);
}

/**
 * Reset signal quality detection state
 * Empty implementation since PPGSignalMeter handles this internally
 */
export function resetSignalQualityState() {
  return {
    consecutiveWeakSignals: 0
  };
}

/**
 * Determines if a measurement should be processed based on signal strength
 * Less strict threshold to allow more signals through
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Reduced threshold
  return Math.abs(value) >= 0.25; // Reduced from 0.33
}

/**
 * Creates default signal processing result when signal is too weak
 * Keeps compatibility with existing code
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
