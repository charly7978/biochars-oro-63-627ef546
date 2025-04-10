
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

/**
 * Calculate pNN50 - percentage of successive RR intervals that differ by more than 50ms
 * 
 * @param intervals Array of RR intervals in milliseconds
 * @returns pNN50 value between 0 and 1
 */
export function calculatePNN50(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  let nn50Count = 0;
  
  // Count successive intervals that differ by more than 50ms
  for (let i = 1; i < intervals.length; i++) {
    if (Math.abs(intervals[i] - intervals[i - 1]) > 50) {
      nn50Count++;
    }
  }
  
  // Calculate percentage
  return nn50Count / (intervals.length - 1);
}

/**
 * Detect irregular heartbeats based on RR interval patterns
 * 
 * @param intervals Array of RR intervals in milliseconds
 * @param threshold Threshold for variation detection (default: 0.25)
 * @returns Array of indices with irregular beats
 */
export function detectIrregularBeats(intervals: number[], threshold: number = 0.25): number[] {
  if (intervals.length < 4) return [];
  
  const irregularIndices: number[] = [];
  
  // Calculate average of recent intervals
  const recentIntervals = intervals.slice(-8);
  const avgInterval = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;
  
  // Detect irregular beats
  for (let i = 0; i < intervals.length; i++) {
    const variation = Math.abs(intervals[i] - avgInterval) / avgInterval;
    if (variation > threshold) {
      irregularIndices.push(i);
    }
  }
  
  return irregularIndices;
}
