
/**
 * Functions for checking signal quality and weak signals
 * Significantly improved to eliminate false positives
 */
import { checkSignalQuality } from '../../../modules/heart-beat/signal-quality';

/**
 * Checks if the signal is too weak, indicating possible finger removal
 * This is a passthrough to the centralized implementation
 * Dramatically improved with much higher thresholds to eliminate false positives
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
  // Use dramatically higher thresholds if not specified
  const finalConfig = {
    lowSignalThreshold: config.lowSignalThreshold || 0.35, // Significantly increased from 0.25
    maxWeakSignalCount: config.maxWeakSignalCount || 9    // Significantly increased from 6
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
 * Simplified passthrough that defers to PPGSignalMeter's implementation
 * Uses much higher threshold to prevent false positives
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Much higher threshold to avoid processing weak signals (likely noise)
  return Math.abs(value) >= 0.35; // Significantly increased from 0.25
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
