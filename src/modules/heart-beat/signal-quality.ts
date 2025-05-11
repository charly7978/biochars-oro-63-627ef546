
/**
 * Check signal quality to detect weak signal or finger removal
 * @param value The PPG signal value
 * @param currentWeakCount Current count of consecutive weak signals
 * @param config Configuration for signal quality detection
 * @returns Object with isWeakSignal flag and updated weak signals count
 */
export function checkSignalQuality(
  value: number,
  currentWeakCount: number,
  config: {
    lowSignalThreshold: number;
    maxWeakSignalCount: number;
  }
): {
  isWeakSignal: boolean;
  updatedWeakSignalsCount: number;
} {
  const { lowSignalThreshold, maxWeakSignalCount } = config;
  
  // Check if current value is below threshold (weak signal)
  const isCurrentValueWeak = Math.abs(value) < lowSignalThreshold;
  
  // Update the weak signal counter
  let updatedCount = isCurrentValueWeak
    ? currentWeakCount + 1
    : Math.max(0, currentWeakCount - 1);
  
  // Determine if the signal is considered weak overall
  const isWeakSignal = updatedCount >= maxWeakSignalCount;
  
  return {
    isWeakSignal,
    updatedWeakSignalsCount: updatedCount
  };
}
