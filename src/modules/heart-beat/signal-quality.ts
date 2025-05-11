
/**
 * Signal quality detection utilities
 * Centralized functions for checking signal quality and finger detection
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
  // Default thresholds
  const LOW_SIGNAL_THRESHOLD = options.lowSignalThreshold || 0.45;
  const MAX_WEAK_SIGNALS = options.maxWeakSignalCount || 5;
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
      : Math.max(0, currentWeakSignalCount - 3); // Even faster decay
  }
  
  // Limit to max
  updatedWeakSignalsCount = Math.min(MAX_WEAK_SIGNALS + 2, updatedWeakSignalsCount);
  
  // Signal is considered weak if we have enough consecutive weak readings
  const isWeakSignal = updatedWeakSignalsCount >= MAX_WEAK_SIGNALS;
  
  // Debug log para verificar que este método se está usando
  console.log("signal-quality checkSignalQuality:", {
    value,
    threshold: LOW_SIGNAL_THRESHOLD,
    isCurrentValueWeak,
    updatedWeakSignalsCount,
    isWeakSignal,
    maxCount: MAX_WEAK_SIGNALS
  });
  
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
