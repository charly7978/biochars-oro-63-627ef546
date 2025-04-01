
/**
 * Calculate the quality of a PPG signal based on various factors
 * @param signal The processed signal data
 * @returns Quality score (0-100)
 */
export function calculateSignalQuality(
  value: number,
  recentValues: number[] = [],
  fingerDetected: boolean = false,
  motionLevel: number = 0
): number {
  if (!fingerDetected) {
    return 0;
  }
  
  // Calculate basic signal metrics
  const signalRange = recentValues.length > 0 
    ? Math.max(...recentValues) - Math.min(...recentValues) 
    : 0;
  
  // If we don't have enough data yet, return a moderate quality
  if (recentValues.length < 5) {
    return fingerDetected ? 40 : 0;
  }
  
  // Calculate stability score
  let stabilityScore = 0;
  if (recentValues.length >= 3) {
    const recentDiffs = [];
    for (let i = 1; i < recentValues.length; i++) {
      recentDiffs.push(Math.abs(recentValues[i] - recentValues[i-1]));
    }
    
    const avgDiff = recentDiffs.reduce((sum, diff) => sum + diff, 0) / recentDiffs.length;
    const maxAllowedDiff = signalRange * 0.5; // 50% of range is max acceptable diff
    
    stabilityScore = Math.max(0, 50 * (1 - (avgDiff / maxAllowedDiff)));
  }
  
  // Calculate consistency score based on variation coefficient
  let consistencyScore = 0;
  if (recentValues.length >= 5) {
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const squaredDiffs = recentValues.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean !== 0 ? (stdDev / mean) : 0;
    
    consistencyScore = Math.max(0, 50 * (1 - Math.min(1, cv * 5)));
  }
  
  // Motion penalty (0-30)
  const motionPenalty = Math.min(30, motionLevel * 30);
  
  // Final quality score (0-100)
  const baseQuality = (stabilityScore + consistencyScore) / 2;
  const finalQuality = Math.max(0, baseQuality - motionPenalty);
  
  return Math.min(100, Math.round(finalQuality));
}
