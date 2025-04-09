
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

/**
 * Normalize a raw signal value to a standard range
 * @param data The raw image data array or signal value
 * @param min Optional minimum output value (default: 0)
 * @param max Optional maximum output value (default: 1)
 * @returns Normalized signal value in the range [min, max]
 */
export function normalizeSignalValue(
  data: Uint8ClampedArray | number[], 
  min: number = 0, 
  max: number = 1
): number {
  // If the input is an array (like image data), compute the average
  if (Array.isArray(data) || data instanceof Uint8ClampedArray) {
    // For RGBA data, only consider the red channel for PPG
    let sum = 0;
    let count = 0;
    
    // Process every 4th element (red channel in RGBA)
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i];
      count++;
    }
    
    // Calculate average and normalize to [min, max]
    const avg = sum / (count || 1);
    return min + (max - min) * (avg / 255);
  }
  
  // If the input is a single number, just normalize it
  return min + (max - min) * (data as number / 255);
}
