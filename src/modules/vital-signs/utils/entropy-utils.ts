
/**
 * Utility functions for entropy calculations in arrhythmia detection
 * Based on information theory approaches from MIT and Stanford research
 */

/**
 * Calculate Shannon Entropy for RR intervals
 * Information theory approach from MIT research
 */
export function calculateShannonEntropy(intervals: number[]): number {
  // Simplified histogram-based entropy calculation
  const bins: {[key: string]: number} = {};
  const binWidth = 25; // 25ms bin width
  
  intervals.forEach(interval => {
    const binKey = Math.floor(interval / binWidth);
    bins[binKey] = (bins[binKey] || 0) + 1;
  });
  
  let entropy = 0;
  const totalPoints = intervals.length;
  
  Object.values(bins).forEach(count => {
    const probability = count / totalPoints;
    entropy -= probability * Math.log2(probability);
  });
  
  return entropy;
}

/**
 * Estimate Sample Entropy (simplified implementation)
 * Based on Massachusetts General Hospital research
 */
export function estimateSampleEntropy(intervals: number[]): number {
  if (intervals.length < 4) return 0;
  
  // Simplified sample entropy estimation
  // In a full implementation, this would use template matching
  const normalizedIntervals = intervals.map(interval => 
    (interval - intervals.reduce((a, b) => a + b, 0) / intervals.length) / 
    Math.max(1, Math.sqrt(intervals.reduce((a, b) => a + Math.pow(b, 2), 0) / intervals.length))
  );
  
  let sumCorr = 0;
  for (let i = 0; i < normalizedIntervals.length - 1; i++) {
    sumCorr += Math.abs(normalizedIntervals[i + 1] - normalizedIntervals[i]);
  }
  
  // Convert to entropy-like measure
  return -Math.log(sumCorr / (normalizedIntervals.length - 1));
}
