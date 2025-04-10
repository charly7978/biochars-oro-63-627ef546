
/**
 * Signal quality assessment utility
 */
export const checkSignalQuality = (
  value: number,
  currentWeakSignalsCount: number,
  config: {
    lowSignalThreshold: number;
    maxWeakSignalCount: number;
  }
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } => {
  // Check for weak signal
  const isWeakSignal = value < config.lowSignalThreshold;
  let updatedWeakSignalsCount = currentWeakSignalsCount;

  if (isWeakSignal) {
    updatedWeakSignalsCount = Math.min(config.maxWeakSignalCount, updatedWeakSignalsCount + 1);
  } else {
    updatedWeakSignalsCount = Math.max(0, updatedWeakSignalsCount - 0.5);
  }

  return { isWeakSignal, updatedWeakSignalsCount };
};
