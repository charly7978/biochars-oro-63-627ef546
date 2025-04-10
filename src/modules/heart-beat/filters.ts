
/**
 * Signal filtering utilities for heart rate processing
 * Provides basic filters for smoothing PPG signals
 */

/**
 * Apply a median filter to the input value using a window of previous values
 * @param value Current signal value
 * @param buffer Buffer of recent values
 * @param windowSize Size of the median window
 * @returns Median-filtered value
 */
export function medianFilter(
  value: number, 
  buffer: number[], 
  windowSize: number
): number {
  // Create a window including the current value and recent values
  const window = [...buffer, value].slice(-windowSize);
  
  // Sort and take the middle value
  const sorted = [...window].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Apply a moving average filter to smooth the signal
 * @param value Current (possibly already filtered) value
 * @param buffer Buffer of recent values
 * @param windowSize Size of the moving average window
 * @returns Moving-average filtered value
 */
export function calculateMovingAverage(
  value: number, 
  buffer: number[], 
  windowSize: number
): number {
  // Create a window including the current value
  const window = [...buffer, value].slice(-windowSize);
  
  // Calculate the mean
  const sum = window.reduce((a, b) => a + b, 0);
  return sum / window.length;
}

/**
 * Apply an exponential moving average filter
 * @param value Current value to filter
 * @param prevSmoothed Previous smoothed value
 * @param alpha Weight for the current value (0-1)
 * @returns Exponentially smoothed value
 */
export function calculateEMA(
  value: number, 
  prevSmoothed: number, 
  alpha: number
): number {
  // If this is the first value, just return it
  if (prevSmoothed === 0 || prevSmoothed === undefined) {
    return value;
  }
  
  // Calculate EMA: alpha * current + (1 - alpha) * previous
  return alpha * value + (1 - alpha) * prevSmoothed;
}
