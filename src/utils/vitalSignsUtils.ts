/**
 * Utility functions for vital signs processing
 */

/**
 * Applies a simple moving average filter to smooth the signal
 * @param values The array of values to smooth
 * @param alpha The smoothing factor (0-1, higher means less smoothing)
 * @returns The smoothed array
 */
export function smoothSignal(values: number[], alpha: number = 0.8): number[] {
  if (values.length <= 1) return [...values];
  
  const result: number[] = [values[0]];
  
  for (let i = 1; i < values.length; i++) {
    const smoothed = alpha * values[i] + (1 - alpha) * result[i - 1];
    result.push(smoothed);
  }
  
  return result;
}

/**
 * Calculates the mean value of an array of numbers
 * @param values The array of values
 * @returns The mean value
 */
export function calculateMeanValue(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculates the median value of an array of numbers
 * @param values The array of values
 * @returns The median value
 */
export function calculateMedianValue(values: number[]): number {
  if (values.length === 0) return 0;

  const sortedValues = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    // If the array has an even number of elements, return the average of the two middle elements
    return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
  } else {
    // If the array has an odd number of elements, return the middle element
    return sortedValues[middleIndex];
  }
}

/**
 * Normalizes an array of numbers to a range between 0 and 1
 * @param values The array of values
 * @returns The normalized array
 */
export function normalizeValues(values: number[]): number[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return values.map(() => 0); // Avoid division by zero
  }

  return values.map(val => (val - min) / (max - min));
}

/**
 * Calculates the standard deviation of an array of numbers
 * @param values The array of values
 * @returns The standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = calculateMeanValue(values);
  const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
  const averageSquaredDifference = calculateMeanValue(squaredDifferences);

  return Math.sqrt(averageSquaredDifference);
}

/**
 * Applies a rolling average to an array of numbers
 * @param values The array of values
 * @param windowSize The number of values to average
 * @returns The array of rolling averages
 */
export function rollingAverage(values: number[], windowSize: number): number[] {
  if (values.length < windowSize) {
    return values; // Not enough values to calculate a rolling average
  }

  const result: number[] = [];
  for (let i = windowSize - 1; i < values.length; i++) {
    const window = values.slice(i - windowSize + 1, i + 1);
    result.push(calculateMeanValue(window));
  }

  return result;
}
