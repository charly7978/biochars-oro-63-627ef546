
/**
 * Utility functions that avoid using Math object methods
 */

export function findMaximum(values: number[]): number {
  if (!values.length) return 0;
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) max = values[i];
  }
  return max;
}

export function findMinimum(values: number[]): number {
  if (!values.length) return 0;
  let min = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) min = values[i];
  }
  return min;
}

export function calculateAverage(values: number[]): number {
  if (!values.length) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

export function truncateToInteger(value: number): number {
  return value | 0;
}

export function absoluteValue(value: number): number {
  return value < 0 ? -value : value;
}

export function generateId(): string {
  return Date.now().toString();
}
