
/**
 * Utility functions that do not use any Math object methods
 * For use in processing real data without any mathematical library functions
 */

/**
 * Returns the maximum value from an array without using Math.max
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

/**
 * Returns the minimum value from an array without using Math.min
 */
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

/**
 * Returns the absolute value without using Math.abs
 */
export function absoluteValue(value: number): number {
  return value >= 0 ? value : -value;
}

/**
 * Calculates the average of an array without using reduce
 */
export function average(values: number[]): number {
  if (!values.length) return 0;
  
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  
  return sum / values.length;
}

/**
 * Rounds a number to the nearest integer without using Math.round
 */
export function roundToInt(value: number): number {
  return value >= 0 ? ~~(value + 0.5) : ~~(value - 0.5);
}

/**
 * Square root approximation without using Math.sqrt (Newton's method)
 */
export function squareRoot(value: number): number {
  if (value === 0) return 0;
  if (value < 0) return NaN;
  
  let x = value;
  for (let i = 0; i < 10; i++) {
    x = 0.5 * (x + value / x);
  }
  
  return x;
}

/**
 * Constrains a value within a range without using Math.min or Math.max
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
