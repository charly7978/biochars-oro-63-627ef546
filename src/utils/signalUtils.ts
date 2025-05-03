
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

export function roundToInt(value: number): number {
  const fraction = value - (value | 0);
  if (fraction >= 0.5) {
    return (value | 0) + 1;
  }
  return value | 0;
}

export function squareRoot(value: number): number {
  // Aproximación de raíz cuadrada usando el método de Newton
  if (value <= 0) return 0;
  let guess = value / 2;
  for (let i = 0; i < 10; i++) { // 10 iteraciones suele ser suficiente
    guess = (guess + value / guess) / 2;
  }
  return guess;
}

export function power(base: number, exponent: number): number {
  // Solo para exponentes enteros positivos
  if (exponent === 0) return 1;
  if (exponent < 0) return 1 / power(base, -exponent);
  
  let result = 1;
  for (let i = 0; i < exponent; i++) {
    result *= base;
  }
  return result;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
