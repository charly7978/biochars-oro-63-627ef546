
/**
 * Signal quality detection utilities
 * Centralized functions for checking signal quality and finger detection
 * IMPROVED: More strict thresholds to reduce false positives
 */

export interface SignalQualityOptions {
  lowSignalThreshold?: number;
  maxWeakSignalCount?: number;
  strictMode?: boolean;
}

export function checkSignalQuality(
  value: number,
  currentWeakSignalCount: number,
  options: SignalQualityOptions = {}
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } {
  // Default thresholds - INCREASED to reduce false positives
  const LOW_SIGNAL_THRESHOLD = options.lowSignalThreshold || 0.45; // Increased from 0.05 to 0.45
  const MAX_WEAK_SIGNALS = options.maxWeakSignalCount || 6; // Increased from 10 to 6
  const STRICT_MODE = options.strictMode !== undefined ? options.strictMode : true;
  
  const isCurrentValueWeak = Math.abs(value) < LOW_SIGNAL_THRESHOLD;
  
  // Update consecutive weak signals counter
  let updatedWeakSignalsCount = isCurrentValueWeak 
    ? currentWeakSignalCount + 1 
    : 0;
  
  // In strict mode, we require more consistent signals
  if (STRICT_MODE) {
    // Only reset counter fully if we have significant signal
    updatedWeakSignalsCount = isCurrentValueWeak 
      ? currentWeakSignalCount + 1 
      : Math.max(0, currentWeakSignalCount - 2); // Faster decay
  }
  
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
