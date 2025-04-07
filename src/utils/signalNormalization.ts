
/**
 * Signal normalization and processing utilities
 */

/**
 * Log signal processing information for debugging
 * @param signalValue The signal value being processed
 * @param processedValue The processed signal value
 * @param metadata Additional metadata for logging
 */
export function logSignalProcessing(
  signalValue: number,
  processedValue: number,
  metadata?: Record<string, any>
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`Signal processing: ${signalValue} -> ${processedValue}`, metadata);
  }
}

/**
 * Apply adaptive filtering to a signal
 * @param value Raw signal value
 * @param previousValues Array of previous values
 * @param alpha Smoothing factor (0-1)
 * @returns Filtered signal value
 */
export function adaptiveFilter(
  value: number,
  previousValues: number[],
  alpha: number = 0.3
): number {
  if (previousValues.length === 0) {
    return value;
  }
  
  // Calculate the moving average of previous values
  const average = previousValues.reduce((sum, val) => sum + val, 0) / previousValues.length;
  
  // Apply exponential weighted moving average
  return alpha * value + (1 - alpha) * average;
}

