
/**
 * Signal filtering utilities for heart rate detection
 */

/**
 * Apply median filter to remove outliers from signal
 * 
 * @param value Current signal value
 * @param buffer Buffer of recent values
 * @param windowSize Window size for the median filter
 * @returns Filtered value
 */
export function medianFilter(value: number, buffer: number[], windowSize: number): number {
  // Make a copy of the buffer and add current value
  const values = [...buffer, value];
  
  // If we have enough values, calculate median
  if (values.length >= windowSize) {
    // Sort values to find median
    const sorted = [...values].sort((a, b) => a - b);
    const medianIndex = Math.floor(sorted.length / 2);
    return sorted[medianIndex];
  }
  
  // Not enough values, return original
  return value;
}

/**
 * Apply moving average filter to smooth the signal
 * 
 * @param value Current signal value
 * @param buffer Buffer of recent values
 * @param windowSize Window size for moving average
 * @returns Filtered value
 */
export function calculateMovingAverage(value: number, buffer: number[], windowSize: number): number {
  // Add current value to calculation
  const values = [...buffer, value];
  
  // If buffer is too short, return original value
  if (values.length === 0) return value;
  
  // Calculate average of recent values
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Apply Exponential Moving Average filter
 * 
 * @param value Current signal value
 * @param prevEMA Previous EMA value
 * @param alpha Weight factor (0-1)
 * @returns Filtered value
 */
export function calculateEMA(value: number, prevEMA: number, alpha: number): number {
  // If no previous EMA, use current value
  if (prevEMA === undefined || prevEMA === null) {
    return value;
  }
  
  // EMA formula: alpha * current + (1 - alpha) * prevEMA
  return alpha * value + (1 - alpha) * prevEMA;
}

/**
 * Apply baseline correction to signal
 * 
 * @param value Current signal value
 * @param baseline Current baseline value
 * @param factor Baseline correction factor (0-1)
 * @returns Updated baseline
 */
export function updateBaseline(value: number, baseline: number, factor: number): number {
  return baseline * factor + value * (1 - factor);
}

/**
 * Low-pass filter implementation
 * 
 * @param value Current signal value
 * @param buffer Recent values buffer
 * @param cutoff Cutoff frequency factor (0-1)
 * @returns Filtered value
 */
export function lowPassFilter(value: number, buffer: number[], cutoff: number): number {
  // Simple implementation using weighted average
  if (buffer.length === 0) return value;
  
  const lastValue = buffer[buffer.length - 1];
  return lastValue + cutoff * (value - lastValue);
}
