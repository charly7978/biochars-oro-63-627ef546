
/**
 * Statistical utilities for signal processing
 */

/**
 * Calculate standard deviation of an array of numbers
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(variance);
}

/**
 * Calculate simple moving average (SMA)
 * @param values Array of values
 * @param period Number of values to average
 */
export function calculateSMA(values: number[], period: number = 3): number[] {
  if (values.length === 0) return [];
  if (values.length <= period) return [values.reduce((sum, val) => sum + val, 0) / values.length];
  
  const sma: number[] = [];
  
  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    const average = window.reduce((sum, val) => sum + val, 0) / period;
    sma.push(average);
  }
  
  return sma;
}

/**
 * Calculate exponential moving average
 * @param values Array of values
 * @param alpha Smoothing factor (0-1)
 */
export function calculateEMA(values: number[], alpha: number = 0.2): number[] {
  if (values.length === 0) return [];
  if (values.length === 1) return [...values];
  
  const ema: number[] = [values[0]];
  
  for (let i = 1; i < values.length; i++) {
    ema.push(alpha * values[i] + (1 - alpha) * ema[i - 1]);
  }
  
  return ema;
}

/**
 * Calculate median of an array of numbers
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sortedValues = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sortedValues.length / 2);
  
  if (sortedValues.length % 2 === 0) {
    return (sortedValues[midpoint - 1] + sortedValues[midpoint]) / 2;
  } else {
    return sortedValues[midpoint];
  }
}

/**
 * Remove outliers using IQR method
 * @param values Array of values
 * @param multiplier IQR multiplier (default 1.5)
 */
export function removeOutliers(values: number[], multiplier: number = 1.5): number[] {
  if (values.length <= 2) return [...values];
  
  const sortedValues = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sortedValues.length * 0.25);
  const q3Index = Math.floor(sortedValues.length * 0.75);
  
  const q1 = sortedValues[q1Index];
  const q3 = sortedValues[q3Index];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;
  
  return values.filter(val => val >= lowerBound && val <= upperBound);
}

/**
 * Calculate percentile of a dataset
 * @param values Array of values
 * @param percentile Percentile to calculate (0-100)
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  if (percentile < 0 || percentile > 100) {
    throw new Error('Percentile must be between 0 and 100');
  }
  
  const sortedValues = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  
  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }
  
  const weight = index - lowerIndex;
  return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}
