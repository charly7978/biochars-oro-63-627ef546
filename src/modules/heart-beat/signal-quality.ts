
/**
 * Check if signal quality is too weak, which might indicate finger removal
 */
export const checkSignalQuality = (
  value: number,
  currentWeakSignalsCount: number,
  options?: {
    lowSignalThreshold?: number;
    maxWeakSignalCount?: number;
  }
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } => {
  const lowSignalThreshold = options?.lowSignalThreshold || 0.05;
  const maxWeakSignalCount = options?.maxWeakSignalCount || 10;
  
  // Check if the signal is too weak (potential finger removal)
  const isWeak = Math.abs(value) < lowSignalThreshold;
  
  // Update weak signals counter
  let updatedCount = isWeak ? currentWeakSignalsCount + 1 : 0;
  
  // Determine if we have too many consecutive weak signals
  const isWeakSignal = updatedCount >= maxWeakSignalCount;
  
  return {
    isWeakSignal,
    updatedWeakSignalsCount: updatedCount
  };
};
