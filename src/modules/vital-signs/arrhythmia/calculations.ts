/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Calculate RMSSD from real RR intervals without using Math functions
 */
export function calculateRMSSD(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  let sumSquaredDiff = 0;
  for (let i = 1; i < intervals.length; i++) {
    const diff = intervals[i] - intervals[i-1];
    sumSquaredDiff += diff * diff;
  }
  
  // Square root approximation without Math.sqrt
  if (sumSquaredDiff === 0) return 0;
  
  const n = intervals.length - 1;
  const mean = sumSquaredDiff / n;
  
  // Newton's method for square root
  let result = mean;
  for (let i = 0; i < 10; i++) {
    if (result === 0) break;
    result = 0.5 * (result + mean / result);
  }
  
  return result;
}

/**
 * Calculate RR interval variation from real data without Math functions
 */
export function calculateRRVariation(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  // Calculate mean without reduce
  let sum = 0;
  for (let i = 0; i < intervals.length; i++) {
    sum += intervals[i];
  }
  const mean = sum / intervals.length;
  
  const lastRR = intervals[intervals.length - 1];
  const diff = lastRR - mean;
  
  // Absolute value without Math.abs
  const absDiff = diff >= 0 ? diff : -diff;
  
  return absDiff / mean;
}

/**
 * Calculate pNN50 metric (percentage of successive RR intervals that differ by more than 50ms)
 */
export function calculatePNN50(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  // Count significant differences without using Math.abs
  let countSignificantDiffs = 0;
  for (let i = 1; i < intervals.length; i++) {
    // Using let instead of const for a value that needs to be modified
    let absDiff = intervals[i] - intervals[i-1];
    if (absDiff < 0) absDiff = -absDiff;  // abs without Math.abs
    
    if (absDiff > 50) {  // >50ms is clinically significant
      countSignificantDiffs++;
    }
  }
  
  // Calculate pNN50
  return intervals.length > 1 ? countSignificantDiffs / (intervals.length - 1) : 0;
}

/**
 * Advanced measure: Poincaré plot analysis for HRV
 * Returns SD1 (short-term variability)
 */
export function calculatePoincareSd1(intervals: number[]): number {
  if (intervals.length < 2) return 0;
  
  // Calculate successive differences
  const successiveDiffs = [];
  for (let i = 1; i < intervals.length; i++) {
    successiveDiffs.push(intervals[i] - intervals[i-1]);
  }
  
  // Calculate variance of successive differences
  let sum = 0;
  for (const diff of successiveDiffs) {
    sum += diff;
  }
  const meanDiff = sum / successiveDiffs.length;
  
  let variance = 0;
  for (const diff of successiveDiffs) {
    const dev = diff - meanDiff;
    variance += dev * dev;
  }
  variance /= successiveDiffs.length;
  
  // SD1 is related to the standard deviation of successive differences
  // SD1 = sqrt(variance/2)
  let sd1 = variance / 2;
  for (let i = 0; i < 10; i++) {
    if (sd1 === 0) break;
    sd1 = 0.5 * (sd1 + (variance/2) / sd1);
  }
  
  return sd1;
}

/**
 * Calculate standard deviation of NN intervals (SDNN)
 */
export function calculateSDNN(intervals: number[]): number {
  if (intervals.length < 2) return 0;

  let sum = 0;
  for (let i = 0; i < intervals.length; i++) {
    sum += intervals[i];
  }
  const mean = sum / intervals.length;

  let sumSqDev = 0;
  for (let i = 0; i < intervals.length; i++) {
    const dev = intervals[i] - mean;
    sumSqDev += dev * dev;
  }
  const variance = sumSqDev / intervals.length; // Use N for population SD

  // Square root approximation
  if (variance === 0) return 0;
  let result = variance;
  for (let i = 0; i < 10; i++) {
    if (result === 0) break;
    result = 0.5 * (result + variance / result);
  }
  return result;
}
