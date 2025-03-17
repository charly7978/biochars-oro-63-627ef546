
/**
 * Smooths a value to reduce jitter and create more visually appealing signal representation.
 * 
 * @param currentValue - The current data point value to be smoothed
 * @param previousValue - The previous smoothed value, or null if this is the first value
 * @returns The smoothed value that should be used for rendering
 */
export function smoothValue(currentValue: number, previousValue: number | null): number {
  const SMOOTHING_FACTOR = 1.6;
  if (previousValue === null) return currentValue;
  return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
}
