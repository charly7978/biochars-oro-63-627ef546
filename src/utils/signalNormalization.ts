
/**
 * Signal normalization utilities
 */

/**
 * Normalize signal value
 * @param data The signal data to normalize
 * @returns Normalized signal value
 */
export function normalizeSignalValue(data: Uint8ClampedArray): number {
  if (!data || data.length === 0) return 0;
  
  // Calculate average of red channel values
  let sum = 0;
  let count = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i]; // Red channel
    count++;
  }
  
  // Normalize to 0-1 range
  const average = count > 0 ? sum / count : 0;
  return average / 255;
}

/**
 * Log signal processing events
 * @param message The message to log
 * @param data Additional data to log
 */
export function logSignalProcessing(message: string, data?: any): void {
  console.log(`[Signal Processing] ${message}`, data || '');
}

/**
 * Apply adaptive filtering to a signal value
 * @param value Current signal value
 * @param history Array of previous values
 * @returns Filtered value
 */
export function adaptiveFilter(value: number, history: number[]): number {
  if (!history || history.length === 0) return value;
  
  // Simple adaptive filtering
  const alpha = 0.3; // Filtering coefficient
  const average = history.reduce((sum, val) => sum + val, 0) / history.length;
  return value * (1 - alpha) + average * alpha;
}
