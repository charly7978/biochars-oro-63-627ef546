
export function smoothValue(currentValue: number, previousValue: number | null): number {
  const SMOOTHING_FACTOR = 1.6;
  if (previousValue === null) return currentValue;
  return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
}
