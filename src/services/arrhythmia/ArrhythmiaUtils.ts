
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { ArrhythmiaCategory } from './types';

/**
 * Calculate the variance of an array of numbers
 */
export function calculateVariance(values: number[]): number {
  if (!values || values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  const sumSquaredDiff = values.reduce((sum, val) => {
    const diff = val - mean;
    return sum + diff * diff;
  }, 0);
  
  return sumSquaredDiff / values.length;
}

/**
 * Calculate RMSSD (Root Mean Square of Successive Differences)
 * A crucial metric for heart rate variability analysis
 */
export function calculateRMSSD(rrIntervals: number[]): number {
  if (!rrIntervals || rrIntervals.length < 2) return 0;
  
  let sumSquaredDiffs = 0;
  let validDiffCount = 0;
  
  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = rrIntervals[i] - rrIntervals[i - 1];
    sumSquaredDiffs += diff * diff;
    validDiffCount++;
  }
  
  if (validDiffCount === 0) return 0;
  
  const meanSquaredDiff = sumSquaredDiffs / validDiffCount;
  return Math.sqrt(meanSquaredDiff);
}

/**
 * Calculate the coefficient of variation of RR intervals
 */
export function calculateRRVariation(rrIntervals: number[]): number {
  if (!rrIntervals || rrIntervals.length < 2) return 0;
  
  const mean = rrIntervals.reduce((sum, rr) => sum + rr, 0) / rrIntervals.length;
  
  if (mean === 0) return 0;
  
  const variance = calculateVariance(rrIntervals);
  const stdDev = Math.sqrt(variance);
  
  // Return as percentage
  return (stdDev / mean) * 100;
}

/**
 * Calculate average heart rate from RR intervals
 */
export function calculateAverageHeartRate(rrIntervals: number[]): number {
  if (!rrIntervals || rrIntervals.length === 0) return 0;
  
  const avgRR = rrIntervals.reduce((sum, rr) => sum + rr, 0) / rrIntervals.length;
  
  if (avgRR <= 0) return 0;
  
  // Convert ms to BPM: 60000 / RR(ms)
  return 60000 / avgRR;
}

/**
 * Check if there is a bigeminy pattern in the RR intervals
 * Bigeminy is a pattern of alternating long and short intervals
 */
export function checkBigeminyPattern(rrIntervals: number[]): boolean {
  if (!rrIntervals || rrIntervals.length < 4) return false;
  
  let alternatingPatternCount = 0;
  
  // Check for alternating long-short pattern
  for (let i = 1; i < rrIntervals.length; i++) {
    const curr = rrIntervals[i];
    const prev = rrIntervals[i - 1];
    
    // If the current RR is significantly different from the previous
    // and we see this alternating pattern consistently
    if ((curr > prev * 1.3 || curr < prev * 0.7) && 
        i > 1 && 
        Math.abs(curr - rrIntervals[i - 2]) / rrIntervals[i - 2] < 0.2) {
      alternatingPatternCount++;
    }
  }
  
  // Return true if we see this pattern multiple times
  return alternatingPatternCount >= 2;
}

/**
 * Categorize the type of arrhythmia based on RR intervals and analysis
 */
export function categorizeArrhythmia(
  rrIntervals: number[],
  rmssd: number,
  rrVariation: number
): ArrhythmiaCategory {
  if (!rrIntervals || rrIntervals.length < 2) {
    return "normal";
  }
  
  // Calculate average heart rate
  const avgHeartRate = calculateAverageHeartRate(rrIntervals);
  
  // Check for tachycardia (fast heart rate)
  if (avgHeartRate > 100) {
    return "tachycardia";
  }
  
  // Check for bradycardia (slow heart rate)
  if (avgHeartRate < 50) {
    return "bradycardia";
  }
  
  // Check for bigeminy
  if (checkBigeminyPattern(rrIntervals)) {
    return "bigeminy";
  }
  
  // Check if RMSSD or RR variation suggests arrhythmia
  if (rmssd > 50 || rrVariation > 20) {
    return "possible-arrhythmia";
  }
  
  // Default to normal
  return "normal";
}
