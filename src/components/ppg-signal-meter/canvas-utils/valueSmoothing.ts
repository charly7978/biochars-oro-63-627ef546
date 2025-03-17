
/**
 * Smooths a signal value to reduce visual jitter when rendering.
 * Uses a simple exponential smoothing algorithm to create more
 * visually appealing signal representation without modifying the 
 * actual measurement data used for calculations.
 * 
 * @param currentValue - The current data point value to be smoothed
 * @param previousValue - The previous smoothed value, or null if this is the first value
 * @returns The smoothed value for display purposes only
 */
export function smoothValue(currentValue: number, previousValue: number | null): number {
  // Visual smoothing factor for display purposes only
  const SMOOTHING_FACTOR = 0.4;
  
  if (previousValue === null) return currentValue;
  
  // Apply exponential smoothing (display purposes only)
  return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
}
