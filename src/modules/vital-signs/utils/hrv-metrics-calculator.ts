
/**
 * Calculator for heart rate variability metrics used in arrhythmia detection
 * Based on ESC Guidelines for arrhythmia detection
 */

/**
 * Calculate advanced non-linear HRV metrics
 * Based on cutting-edge HRV research from MIT and Stanford labs
 */
export function calculateNonLinearMetrics(rrIntervals: number[]): {
  pnnX: number;
  shannonEntropy: number;
  sampleEntropy: number;
} {
  // Import entropy calculation functions
  const { calculateShannonEntropy, estimateSampleEntropy } = require('./entropy-utils');
  
  // Calculate pNNx (percentage of successive RR intervals differing by more than x ms)
  // Used by Mayo Clinic for arrhythmia analysis
  let countAboveThreshold = 0;
  for (let i = 1; i < rrIntervals.length; i++) {
    if (Math.abs(rrIntervals[i] - rrIntervals[i-1]) > 50) {
      countAboveThreshold++;
    }
  }
  const pnnX = countAboveThreshold / (rrIntervals.length - 1);
  
  // Calculate Shannon Entropy (information theory approach)
  const shannonEntropy = calculateShannonEntropy(rrIntervals);
  
  // Sample Entropy calculation (simplified)
  const sampleEntropy = estimateSampleEntropy(rrIntervals);
  
  return {
    pnnX,
    shannonEntropy,
    sampleEntropy
  };
}

/**
 * Calculate RMSSD with validation
 */
export function calculateRMSSD(recentRR: number[]): {
  rmssd: number;
  validIntervals: number;
} {
  let sumSquaredDiff = 0;
  let validIntervals = 0;
  
  for (let i = 1; i < recentRR.length; i++) {
    const diff = recentRR[i] - recentRR[i-1];
    // Only count intervals within physiological limits
    if (recentRR[i] >= 500 && recentRR[i] <= 1500) {
      sumSquaredDiff += diff * diff;
      validIntervals++;
    }
  }
  
  const rmssd = validIntervals > 0 ? 
    Math.sqrt(sumSquaredDiff / validIntervals) : 0;
    
  return { rmssd, validIntervals };
}

/**
 * Calculate RR variation and related metrics
 */
export function calculateRRVariation(validRRs: number[]): {
  avgRR: number;
  lastRR: number;
  rrStandardDeviation: number;
  coefficientOfVariation: number;
  rrVariation: number;
} {
  const avgRR = validRRs.reduce((a, b) => a + b, 0) / validRRs.length;
  const lastRR = validRRs[validRRs.length - 1];
  
  // Calculate standard deviation
  const rrStandardDeviation = Math.sqrt(
    validRRs.reduce((sum, val) => sum + Math.pow(val - avgRR, 2), 0) / validRRs.length
  );
  
  const coefficientOfVariation = rrStandardDeviation / avgRR;
  const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
  
  return {
    avgRR,
    lastRR,
    rrStandardDeviation,
    coefficientOfVariation,
    rrVariation
  };
}
