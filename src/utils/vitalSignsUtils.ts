
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

/**
 * Finds peaks and valleys in a signal
 * @param values The array of values to analyze
 * @returns Object containing indices of peaks and valleys
 */
export function findPeaksAndValleys(values: number[]) {
  const peakIndices: number[] = [];
  const valleyIndices: number[] = [];

  for (let i = 2; i < values.length - 2; i++) {
    const v = values[i];
    if (
      v > values[i - 1] &&
      v > values[i - 2] &&
      v > values[i + 1] &&
      v > values[i + 2]
    ) {
      peakIndices.push(i);
    }
    if (
      v < values[i - 1] &&
      v < values[i - 2] &&
      v < values[i + 1] &&
      v < values[i + 2]
    ) {
      valleyIndices.push(i);
    }
  }
  return { peakIndices, valleyIndices };
}

/**
 * Calculates the AC component (amplitude) of a PPG signal
 * @param values The array of PPG values
 * @returns The AC component value
 */
export function calculateAC(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calculates the DC component (baseline) of a PPG signal
 * @param values The array of PPG values
 * @returns The DC component value
 */
export function calculateDC(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculates the amplitude of a PPG signal using peaks and valleys
 * @param values The PPG signal values
 * @param peaks Indices of peaks in the signal
 * @param valleys Indices of valleys in the signal
 * @returns The mean amplitude
 */
export function calculateAmplitude(
  values: number[],
  peaks: number[],
  valleys: number[]
): number {
  if (peaks.length === 0 || valleys.length === 0) return 0;

  const amps: number[] = [];
  const len = Math.min(peaks.length, valleys.length);
  for (let i = 0; i < len; i++) {
    const amp = values[peaks[i]] - values[valleys[i]];
    if (amp > 0) {
      amps.push(amp);
    }
  }
  if (amps.length === 0) return 0;

  const mean = amps.reduce((a, b) => a + b, 0) / amps.length;
  return mean;
}
