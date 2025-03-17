
/**
 * Utilities for analyzing RR intervals
 */

/**
 * Calculate Root Mean Square of Successive Differences
 */
export function calculateRMSSD(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  let sumSquaredDiff = 0;
  for (let i = 1; i < intervals.length; i++) {
    sumSquaredDiff += Math.pow(intervals[i] - intervals[i-1], 2);
  }
  
  return Math.sqrt(sumSquaredDiff / (intervals.length - 1));
}

/**
 * Calculate standard deviation of RR intervals
 */
export function calculateRRSD(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  
  let sumSquaredDiff = 0;
  for (let i = 0; i < intervals.length; i++) {
    sumSquaredDiff += Math.pow(intervals[i] - mean, 2);
  }
  
  return Math.sqrt(sumSquaredDiff / intervals.length);
}

/**
 * Extended logging for RR analysis
 */
export function logRRAnalysis(
  rmssd: number,
  rrSD: number,
  intervals: number[]
): void {
  console.log("Heart Rate Analysis:", {
    rmssd: rmssd,
    rrSD: rrSD,
    intervals: intervals.slice(-3),
    timestamp: new Date().toISOString()
  });
}
