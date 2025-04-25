
/**
 * Utility functions that do not use any Math object methods
 * For use in processing real data without any mathematical library functions
 */

export function findMaximum(values: number[]): number {
  if (!values.length) return 0;
  
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] > max) {
      max = values[i];
    }
  }
  
  return max;
}

export function findMinimum(values: number[]): number {
  if (!values.length) return 0;
  
  let min = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) {
      min = values[i];
    }
  }
  
  return min;
}

export function absoluteValue(value: number): number {
  return value >= 0 ? value : -value;
}

export function average(values: number[]): number {
  if (!values.length) return 0;
  
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  
  return sum / values.length;
}

export function roundToInt(value: number): number {
  return value >= 0 ? ~~(value + 0.5) : ~~(value - 0.5);
}

export function squareRoot(value: number): number {
  if (value === 0) return 0;
  if (value < 0) return NaN;
  
  let x = value;
  for (let i = 0; i < 10; i++) {
    x = 0.5 * (x + value / x);
  }
  
  return x;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
