
/**
 * Signal filtering utilities for PPG signal processing
 * Extracted from SignalProcessor for better maintainability
 */

/**
 * Apply Simple Moving Average filter to a value
 */
export function applySMAFilter(value: number, values: number[], windowSize: number = 15): number {
  if (values.length < windowSize) {
    return value;
  }
  
  const recentValues = values.slice(-windowSize);
  const sum = recentValues.reduce((acc, val) => acc + val, 0);
  return (sum + value) / (windowSize + 1);
}

/**
 * Update consistency metrics
 */
export function updateConsistencyMetrics(
  value: number, 
  consistencyHistory: number[], 
  consistencyBufferSize: number
): number[] {
  const updatedHistory = [...consistencyHistory, value].slice(-consistencyBufferSize);
  return updatedHistory;
}
