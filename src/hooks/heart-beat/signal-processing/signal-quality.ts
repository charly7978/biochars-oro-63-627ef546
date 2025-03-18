
/**
 * Functions for checking signal quality and weak signals
 */
import { checkSignalQuality } from '../../../modules/heart-beat/signal-quality';

/**
 * Checks if the signal is too weak, indicating possible finger removal
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
  return checkSignalQuality(value, consecutiveWeakSignalsCount, config);
}

/**
 * Reset signal quality detection state
 */
export function resetSignalQualityState() {
  return {
    consecutiveWeakSignals: 0
  };
}

/**
 * Determines if a measurement should be processed based on signal strength
 */
export function shouldProcessMeasurement(value: number): boolean {
  // Don't process signals that are too small (likely noise)
  return Math.abs(value) >= 0.05;
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
