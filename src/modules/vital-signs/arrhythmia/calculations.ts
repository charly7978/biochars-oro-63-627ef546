
/**
 * Arrhythmia detection calculation functions
 */

/**
 * Calculate RMSSD (Root Mean Square of Successive Differences)
 * @param rrIntervals Array of RR intervals in milliseconds
 * @returns RMSSD value
 */
export function calculateRMSSD(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  
  // Calculate successive differences
  const differences: number[] = [];
  for (let i = 1; i < rrIntervals.length; i++) {
    differences.push(rrIntervals[i] - rrIntervals[i-1]);
  }
  
  // Square the differences
  const squaredDifferences = differences.map(diff => diff * diff);
  
  // Calculate the mean of squared differences
  const meanSquaredDifferences = squaredDifferences.reduce((sum, val) => sum + val, 0) / 
                               squaredDifferences.length;
  
  // Return the square root of the mean
  return Math.sqrt(meanSquaredDifferences);
}

/**
 * Calculate RR variation ratio
 * @param rrIntervals Array of RR intervals in milliseconds
 * @returns Variation ratio (0-1)
 */
export function calculateRRVariation(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  
  const mean = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  
  // If the last interval is very different from the mean, consider it a variation
  const lastInterval = rrIntervals[rrIntervals.length - 1];
  const variation = Math.abs(lastInterval - mean) / mean;
  
  return variation;
}

/**
 * Calculate standard deviation of NN intervals (SDNN)
 * @param rrIntervals Array of RR intervals in milliseconds
 * @returns SDNN value
 */
export function calculateSDNN(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  
  const mean = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  const squaredDeviations = rrIntervals.map(interval => Math.pow(interval - mean, 2));
  const variance = squaredDeviations.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  
  return Math.sqrt(variance);
}

/**
 * Calculate the coefficient of variation (CV) of RR intervals
 * @param rrIntervals Array of RR intervals in milliseconds
 * @returns CV value
 */
export function calculateCV(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  
  const mean = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
  const sdnn = calculateSDNN(rrIntervals);
  
  return sdnn / mean;
}
