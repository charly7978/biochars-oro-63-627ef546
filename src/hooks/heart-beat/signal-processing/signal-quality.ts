
/**
 * Functions for checking signal quality and weak signals
 * Improved to reduce false positives
 */
import { checkSignalQuality } from '../../../modules/heart-beat/signal-quality';

/**
 * Checks if the signal is too weak, indicating possible finger removal
 * This is a passthrough to the centralized implementation
 * Improved with higher thresholds to reduce false positives
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
  // Use higher thresholds if not specified
  const finalConfig = {
    lowSignalThreshold: config.lowSignalThreshold || 0.15, // Increased from default 0.1
    maxWeakSignalCount: config.maxWeakSignalCount || 4    // Increased from default 3
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
 * Uses higher threshold to prevent false positives
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Higher threshold to avoid processing weak signals (likely noise)
  return Math.abs(value) >= 0.15; // Increased from 0.05
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
