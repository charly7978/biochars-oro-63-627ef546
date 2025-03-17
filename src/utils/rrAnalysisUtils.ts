
/**
 * RR interval analysis utilities
 */

/**
 * Analyzes RR intervals for heart rate calculations
 */
export function analyzeRRIntervals(
  rrData: { intervals: number[] } | undefined,
  currentTime: number,
  lastArrhythmiaTime: number,
  arrhythmiaCounter: number,
  minTimeBetweenArrhythmias: number,
  maxArrhythmiasPerSession: number
): {
  hasArrhythmia: boolean;
  shouldIncrementCounter: boolean;
  analysisData?: {
    rmssd: number;
    rrVariation: number;
    lastRR: number;
    avgRR: number;
    rrSD: number;
  };
} {
  // Ensure sufficient data
  if (!rrData?.intervals || rrData.intervals.length < 16) {
    return { hasArrhythmia: false, shouldIncrementCounter: false };
  }

  // Extract the most relevant intervals
  const lastIntervals = rrData.intervals.slice(-16);
  
  // Filter only valid intervals (within physiological limits)
  const validIntervals = lastIntervals.filter(interval => interval >= 400 && interval <= 1500);
  
  // Validate signal quality
  if (validIntervals.length < lastIntervals.length * 0.75) {
    return { hasArrhythmia: false, shouldIncrementCounter: false };
  }
  
  // Calculate time-domain metrics
  const avgRR = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
  const lastRR = validIntervals[validIntervals.length - 1];
  
  // Calculate normalized variation metric
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
    hasArrhythmia: false, 
    shouldIncrementCounter: false,
    analysisData: { 
      rmssd, 
      rrVariation, 
      lastRR, 
      avgRR, 
      rrSD
    }
  };
}

/**
 * Extended logging for RR analysis
 */
export function logRRAnalysis(
  analysisData: { 
    rmssd: number; 
    rrVariation: number; 
    rrSD: number; 
    lastRR: number; 
    avgRR: number;
  },
  lastThreeIntervals: number[]
): void {
  console.log("RR Analysis", {
    rmssd: analysisData.rmssd,
    rrVariation: analysisData.rrVariation,
    rrSD: analysisData.rrSD,
    lastRR: analysisData.lastRR,
    avgRR: analysisData.avgRR,
    lastThreeIntervals,
    timestamp: new Date().toISOString()
  });
}

/**
 * Diagnostic logging for heart beat metrics
 */
export function logHeartRateData(
  analysisData: { 
    rmssd: number; 
    rrVariation: number; 
    rrSD: number;
  },
): void {
  console.log("Heart rate data:", {
    rmssd: analysisData.rmssd,
    rrVariation: analysisData.rrVariation,
    rrSD: analysisData.rrSD,
    timestamp: new Date().toISOString()
  });
}
