
/**
 * Utility functions for arrhythmia-related calculations
 */

/**
 * Calculate RMSSD (Root Mean Square of Successive Differences)
 * Key metric for heart rate variability
 * @param intervals Array of RR intervals
 * @returns RMSSD value
 */
export function calculateRMSSD(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  const differences = [];
  for (let i = 1; i < intervals.length; i++) {
    differences.push(intervals[i] - intervals[i-1]);
  }
  
  const squaredDifferences = differences.map(diff => diff * diff);
  const meanSquaredDiff = squaredDifferences.reduce((sum, val) => sum + val, 0) / squaredDifferences.length;
  
  return Math.sqrt(meanSquaredDiff);
}

/**
 * Calculate RR variation as a normalized measure
 * @param intervals Array of RR intervals
 * @returns Normalized variation
 */
export function calculateRRVariation(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const lastRR = intervals[intervals.length - 1];
  
  return Math.abs(lastRR - mean) / mean;
}

/**
 * Calculate pNN50 - Percentage of successive RR intervals that differ by more than 50ms
 * @param intervals Array of RR intervals
 * @returns pNN50 value (percentage)
 */
export function calculatePNN50(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  let nn50Count = 0;
  for (let i = 1; i < intervals.length; i++) {
    if (Math.abs(intervals[i] - intervals[i-1]) > 50) {
      nn50Count++;
    }
  }
  
  return (nn50Count / (intervals.length - 1)) * 100;
}

/**
 * Calculate SDNN - Standard Deviation of NN (normal-to-normal) intervals
 * @param intervals Array of RR intervals
 * @returns SDNN value
 */
export function calculateSDNN(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const squaredDifferences = intervals.map(interval => Math.pow(interval - mean, 2));
  const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / intervals.length;
  
  return Math.sqrt(variance);
}
