
/**
 * Basic RR interval analysis utilities
 */

/**
 * Analyzes RR intervals for heart rate variability metrics
 */
export function analyzeRRIntervals(
  rrData: { intervals: number[] } | undefined,
  currentTime: number
): {
  analysisData?: {
    rmssd: number;
    rrVariation: number;
    lastRR: number;
    avgRR: number;
    rrSD: number;
  };
} {
  // Analysis requires sufficient data
  if (!rrData?.intervals || rrData.intervals.length < 16) {
    return { analysisData: undefined };
  }

  // Extract the most relevant intervals
  const lastIntervals = rrData.intervals.slice(-16);
  
  // Apply filtering with physiological constraints
  // Human heart rate boundaries: 40-150 BPM (400-1500ms intervals)
  const validIntervals = lastIntervals.filter(interval => interval >= 400 && interval <= 1500);
  
  // Check for sufficient data
  if (validIntervals.length < lastIntervals.length * 0.75) {
    return { analysisData: undefined };
  }
  
  // Calculate time-domain metrics
  const avgRR = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
  const lastRR = validIntervals[validIntervals.length - 1];
  
  // Calculate variation metric
  const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
  
  // Compute Root Mean Square of Successive Differences
  let sumSquaredDiff = 0;
  for (let i = 1; i < validIntervals.length; i++) {
    sumSquaredDiff += Math.pow(validIntervals[i] - validIntervals[i-1], 2);
  }
  const rmssd = Math.sqrt(sumSquaredDiff / (validIntervals.length - 1));
  
  // Calculate statistical dispersion
  const rrSD = Math.sqrt(
    validIntervals.reduce((acc, val) => acc + Math.pow(val - avgRR, 2), 0) / 
    validIntervals.length
  );
  
  return { 
    analysisData: { 
      rmssd, 
      rrVariation, 
      lastRR, 
      avgRR, 
      rrSD
    }
  };
}
