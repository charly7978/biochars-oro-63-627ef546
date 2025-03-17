
/**
 * Signal quality assessment utilities
 * Extracted from SignalProcessor for better maintainability
 */

import { findPeaksEnhanced } from './peak-detection';

/**
 * Calculate signal quality based on multiple criteria
 * Returns 0-100 quality score
 */
export function calculateSignalQuality(values: number[], noiseLevel: number): number {
  // No quality assessment with insufficient data
  if (values.length < 15) { 
    return 30; // Lower default quality
  }
  
  // Factor 1: Noise level (lower is better)
  const noiseScore = Math.max(0, 100 - (noiseLevel * 5)); 
  
  // Factor 2: Signal stability
  const recentValues = values.slice(-15);
  const sum = recentValues.reduce((a, b) => a + b, 0);
  const mean = sum / recentValues.length;
  const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
  const stabilityScore = Math.max(0, 100 - Math.min(100, variance / 1.5));
  
  // Factor 3: Signal range (look for cardiac-like amplitude)
  const min = Math.min(...recentValues);
  const max = Math.max(...recentValues);
  const range = max - min;
  
  const MIN_REQUIRED_AMPLITUDE = 10; // Minimum amplitude for a valid PPG signal
  const MAX_ALLOWED_AMPLITUDE = 120; // Maximum amplitude for a valid PPG signal
  
  let rangeScore = 0;
  if (range >= MIN_REQUIRED_AMPLITUDE && range <= MAX_ALLOWED_AMPLITUDE) {
    // Optimal range
    rangeScore = 100;
  } else if (range < MIN_REQUIRED_AMPLITUDE) {
    // Too small - likely no finger
    rangeScore = Math.max(0, (range / MIN_REQUIRED_AMPLITUDE) * 80);
  } else {
    // Too large - likely motion artifact
    rangeScore = Math.max(0, 100 - ((range - MAX_ALLOWED_AMPLITUDE) / 20));
  }
  
  // Factor 4: Pattern consistency
  const patternScore = evaluatePatternConsistency(recentValues);
  
  // Weighted average of factors with updated weights
  const quality = Math.round(
    (noiseScore * 0.25) +
    (stabilityScore * 0.3) +
    (rangeScore * 0.25) +
    (patternScore * 0.2)
  );
  
  return Math.min(100, Math.max(0, quality));
}

/**
 * Evaluate pattern consistency of the signal
 * Real PPG signals have consistent periodic patterns
 */
export function evaluatePatternConsistency(values: number[]): number {
  if (values.length < 10) {
    return 50;
  }
  
  // Find peaks to analyze pattern
  const peaks = findPeaksEnhanced(values);
  
  if (peaks.length < 2) {
    return 30; // Penalize if we can't find clear peaks
  }
  
  // Calculate intervals between peaks
  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i-1]);
  }
  
  // Calculate interval consistency
  const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const intervalVariation = intervals.reduce((sum, val) => sum + Math.abs(val - avgInterval), 0) / intervals.length;
  const consistencyRatio = intervalVariation / avgInterval;
  
  // Lower ratio = more consistent
  const consistencyScore = Math.max(0, 100 - (consistencyRatio * 100));
  
  // Check for physiologically reasonable rate
  // Assumes 30 samples/sec and intervals should be between 0.5 and 2 seconds
  // for heart rates between 30 and 120 bpm
  const MIN_CROSS_ZERO_RATE = 15; // Min peaks interval for real PPG
  const MAX_CROSS_ZERO_RATE = 60; // Max peaks interval for real PPG
  const isPhysiological = avgInterval >= MIN_CROSS_ZERO_RATE && avgInterval <= MAX_CROSS_ZERO_RATE;
  
  return isPhysiological ? consistencyScore : Math.min(60, consistencyScore);
}
