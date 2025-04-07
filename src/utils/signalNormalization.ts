
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
