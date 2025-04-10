
/**
 * Calculation utilities for arrhythmia detection
 */

/**
 * Calculate the Root Mean Square of Successive Differences (RMSSD)
 * RMSSD is a time-domain measure of heart rate variability
 * 
 * @param intervals Array of RR intervals in milliseconds
 * @returns RMSSD value
 */
export function calculateRMSSD(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  let sumSquaredDiffs = 0;
  
  // Calculate successive differences and square them
  for (let i = 1; i < intervals.length; i++) {
    const diff = intervals[i] - intervals[i - 1];
    sumSquaredDiffs += diff * diff;
  }
  
  // Calculate mean of squared differences
  const meanSquaredDiff = sumSquaredDiffs / (intervals.length - 1);
  
  // Return square root of mean squared differences
  return Math.sqrt(meanSquaredDiff);
}

/**
 * Calculate RR interval variation as a normalized measure
 * 
 * @param intervals Array of RR intervals in milliseconds
 * @returns Variation ratio between 0 and 1
 */
export function calculateRRVariation(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  // Calculate average RR interval
  const sum = intervals.reduce((a, b) => a + b, 0);
  const avg = sum / intervals.length;
  
  // Calculate absolute deviations
  const deviations = intervals.map(interval => Math.abs(interval - avg));
  
  // Calculate mean absolute deviation
  const meanDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
  
  // Normalize by average RR interval to get variation ratio
  return meanDeviation / avg;
}
