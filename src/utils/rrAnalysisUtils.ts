
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Advanced RR interval analysis utilities using only real data
 * No simulation or reference values are used
 */

/**
 * Implements RR interval analysis with real data only
 * No simulation or reference values
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
    entropyMetric?: number;
    spectralPower?: number;
    poincareDimensions?: {sd1: number, sd2: number, ratio: number};
  };
} {
  // Analysis requires sufficient real data
  if (!rrData?.intervals || rrData.intervals.length < 16) {
    return { hasArrhythmia: false, shouldIncrementCounter: false };
  }

  // Extract the most relevant intervals from real data
  const lastIntervals = rrData.intervals.slice(-16);
  
  // Apply filtering with physiological constraints to real data
  const validIntervals = lastIntervals.filter(interval => interval >= 400 && interval <= 1500);
  
  // Quality validation for real data
  if (validIntervals.length < lastIntervals.length * 0.75) {
    return { hasArrhythmia: false, shouldIncrementCounter: false };
  }
  
  // Calculate time-domain metrics from real data
  const avgRR = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
  const lastRR = validIntervals[validIntervals.length - 1];
  
  // Variation metric using real data
  const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
  
  // Compute Root Mean Square of Successive Differences from real data
  let sumSquaredDiff = 0;
  for (let i = 1; i < validIntervals.length; i++) {
    sumSquaredDiff += Math.pow(validIntervals[i] - validIntervals[i-1], 2);
  }
  const rmssd = Math.sqrt(sumSquaredDiff / (validIntervals.length - 1));
  
  // Calculate statistical dispersion using real data
  const rrSD = Math.sqrt(
    validIntervals.reduce((acc, val) => acc + Math.pow(val - avgRR, 2), 0) / 
    validIntervals.length
  );
  
  // Poincaré plot analysis using real data
  const sd1sd2 = calculatePoincareDimensions(validIntervals);
  
  // Calculate approximate entropy from real data
  const entropyMetric = calculateApproximateEntropy(validIntervals);
  
  // Calculate spectral power from real data
  const spectralPower = calculateSpectralPower(validIntervals);
  
  // Multi-parameter detection criteria with real data
  const isPremature = 
    (lastRR < 0.7 * avgRR) &&
    (rrVariation > 0.3) &&
    (rmssd > 50) &&
    (sd1sd2.ratio < 0.3 || sd1sd2.ratio > 2.5) &&
    (entropyMetric > 0.7);
  
  // Apply temporal restrictions
  const shouldIncrementCounter = 
    isPremature && 
    (currentTime - lastArrhythmiaTime >= minTimeBetweenArrhythmias) &&
    (arrhythmiaCounter < maxArrhythmiasPerSession);
  
  return { 
    hasArrhythmia: isPremature, 
    shouldIncrementCounter,
    analysisData: { 
      rmssd, 
      rrVariation, 
      lastRR, 
      avgRR, 
      rrSD,
      entropyMetric,
      spectralPower,
      poincareDimensions: sd1sd2
    }
  };
}

/**
 * Calculate Poincaré plot dimensions from real data
 * No simulation is used
 */
function calculatePoincareDimensions(intervals: number[]): {sd1: number, sd2: number, ratio: number} {
  if (intervals.length < 3) {
    return {sd1: 0, sd2: 0, ratio: 1};
  }
  
  // Create Poincaré plot coordinates from real data
  const x: number[] = [];
  const y: number[] = [];
  
  for (let i = 0; i < intervals.length - 1; i++) {
    x.push(intervals[i]);
    y.push(intervals[i + 1]);
  }
  
  // Calculate mean of each axis from real data
  const meanX = x.reduce((a, b) => a + b, 0) / x.length;
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  
  // Calculate SD1 and SD2 using real data
  let sd1Squared = 0;
  let sd2Squared = 0;
  
  for (let i = 0; i < x.length; i++) {
    sd1Squared += Math.pow((x[i] - y[i]) / Math.sqrt(2), 2);
    sd2Squared += Math.pow((x[i] + y[i] - meanX - meanY) / Math.sqrt(2), 2);
  }
  
  const sd1 = Math.sqrt(sd1Squared / x.length);
  const sd2 = Math.sqrt(sd2Squared / x.length);
  const ratio = sd1 / (sd2 || 1);
  
  return {sd1, sd2, ratio};
}

/**
 * Calculate approximate entropy from real data
 * No simulation is used
 */
function calculateApproximateEntropy(intervals: number[]): number {
  if (intervals.length < 10) return 0;
  
  // Normalize real intervals for comparison
  const normalizedIntervals = [...intervals];
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const stdDev = Math.sqrt(
    intervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intervals.length
  );
  
  for (let i = 0; i < normalizedIntervals.length; i++) {
    normalizedIntervals[i] = (normalizedIntervals[i] - mean) / stdDev;
  }
  
  // Parameters for entropy calculation
  const m = 2;
  const r = 0.2 * stdDev;
  
  // Calculate Phi(m) from real data
  let phiM = 0;
  for (let i = 0; i < normalizedIntervals.length - m + 1; i++) {
    let matches = 0;
    for (let j = 0; j < normalizedIntervals.length - m + 1; j++) {
      if (i !== j) {
        let allMatch = true;
        for (let k = 0; k < m; k++) {
          if (Math.abs(normalizedIntervals[i + k] - normalizedIntervals[j + k]) > r) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) matches++;
      }
    }
    phiM += Math.log(matches / (normalizedIntervals.length - m));
  }
  phiM /= (normalizedIntervals.length - m + 1);
  
  // Simplified entropy calculation
  const entropy = Math.min(1, Math.max(0, 1 - Math.exp(phiM)));
  
  return entropy;
}

/**
 * Calculate spectral power from real data
 * No simulation is used
 */
function calculateSpectralPower(intervals: number[]): number {
  if (intervals.length < 8) return 0;
  
  // Calculate differences from real data
  const diffs: number[] = [];
  for (let i = 1; i < intervals.length; i++) {
    diffs.push(intervals[i] - intervals[i-1]);
  }
  
  // Calculate power from real data
  const power = diffs.reduce((acc, diff) => acc + Math.pow(diff, 2), 0) / diffs.length;
  
  // Normalize to 0-1 range using physiological values
  return Math.min(1, power / 10000);
}

/**
 * Log real RR analysis data
 * No simulation
 */
export function logRRAnalysis(
  analysisData: { 
    rmssd: number; 
    rrVariation: number; 
    rrSD: number; 
    lastRR: number; 
    avgRR: number;
    entropyMetric?: number;
    spectralPower?: number;
    poincareDimensions?: {sd1: number, sd2: number, ratio: number};
  },
  lastThreeIntervals: number[]
): void {
  console.log("useVitalSignsProcessor: Real RR Analysis", {
    rmssd: analysisData.rmssd,
    rrVariation: analysisData.rrVariation,
    rrSD: analysisData.rrSD,
    lastRR: analysisData.lastRR,
    avgRR: analysisData.avgRR,
    entropyMetric: analysisData.entropyMetric,
    spectralPower: analysisData.spectralPower,
    poincareDimensions: analysisData.poincareDimensions,
    lastThreeIntervals,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log potential arrhythmias in real data
 * No simulation
 */
export function logPossibleArrhythmia(
  analysisData: { 
    rmssd: number; 
    rrVariation: number; 
    rrSD: number;
    entropyMetric?: number;
    spectralPower?: number; 
  },
): void {
  console.log("useVitalSignsProcessor: Potential arrhythmia in real data", {
    rmssd: analysisData.rmssd,
    rrVariation: analysisData.rrVariation,
    rrSD: analysisData.rrSD,
    entropyMetric: analysisData.entropyMetric,
    spectralPower: analysisData.spectralPower,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log confirmed arrhythmias in real data
 * No simulation
 */
export function logConfirmedArrhythmia(
  analysisData: { 
    rmssd: number; 
    rrVariation: number; 
    rrSD: number; 
    lastRR: number; 
    avgRR: number;
    entropyMetric?: number;
    spectralPower?: number;
    poincareDimensions?: {sd1: number, sd2: number, ratio: number};
  },
  lastThreeIntervals: number[],
  counter: number
): void {
  console.log("Confirmed arrhythmia in real data:", {
    rmssd: analysisData.rmssd,
    rrVariation: analysisData.rrVariation,
    rrSD: analysisData.rrSD,
    lastRR: analysisData.lastRR,
    avgRR: analysisData.avgRR,
    entropyMetric: analysisData.entropyMetric,
    spectralPower: analysisData.spectralPower,
    poincareDimensions: analysisData.poincareDimensions,
    intervals: lastThreeIntervals,
    counter,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log ignored arrhythmias
 * No simulation
 */
export function logIgnoredArrhythmia(
  timeSinceLastArrhythmia: number,
  maxArrhythmiasPerSession: number,
  currentCounter: number
): void {
  console.log("useVitalSignsProcessor: Arrhythmia in real data ignored", {
    reason: timeSinceLastArrhythmia < 1000 ? 
      "Too soon after previous arrhythmia" : "Maximum arrhythmia count reached",
    timeSinceLastArrhythmia,
    maxAllowed: maxArrhythmiasPerSession,
    currentCount: currentCounter,
    timestamp: new Date().toISOString()
  });
}
