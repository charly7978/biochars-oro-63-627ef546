
/**
 * Function to check signal quality and detect weak signals
 * Used to identify when the finger is removed from the sensor
 */
export const checkSignalQuality = (
  value: number, 
  weakSignalsCount: number,
  options: {
    lowSignalThreshold: number;
    maxWeakSignalCount: number;
  }
): { isWeakSignal: boolean; updatedWeakSignalsCount: number } => {
  const { lowSignalThreshold, maxWeakSignalCount } = options;
  
  // Check if the signal is too weak (potentially finger removed)
  const isWeakSignal = value < lowSignalThreshold;
  let updatedWeakSignalsCount = weakSignalsCount;
  
  // If signal is weak, increment counter, otherwise decrement it gradually
  if (isWeakSignal) {
    updatedWeakSignalsCount = Math.min(maxWeakSignalCount, updatedWeakSignalsCount + 1);
  } else {
    updatedWeakSignalsCount = Math.max(0, updatedWeakSignalsCount - 0.5);
  }
  
  return { 
    isWeakSignal: updatedWeakSignalsCount >= maxWeakSignalCount, 
    updatedWeakSignalsCount 
  };
};
