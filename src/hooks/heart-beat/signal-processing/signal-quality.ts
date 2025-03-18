
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
