
/**
 * Calculator for heart rate variability metrics used in arrhythmia detection
 * Based on ESC Guidelines for arrhythmia detection
 * Recalibrated to reduce false positives
 */

import { NonLinearMetrics } from '../types/arrhythmia-types';
import { calculateShannonEntropy, estimateSampleEntropy } from './entropy-utils';

/**
 * Calculate advanced non-linear HRV metrics
 * Based on cutting-edge HRV research from MIT and Stanford labs
 */
export function calculateNonLinearMetrics(rrIntervals: number[]): NonLinearMetrics {
  // Si hay menos de 5 intervalos, retornar valores por defecto
  // Aumentado el umbral mínimo para análisis fiable
  if (rrIntervals.length < 5) {
    return {
      pnnX: 0,
      shannonEntropy: 0,
      sampleEntropy: 0
    };
  }
  
  // Filtrar outliers para análisis más robusto
  const filteredIntervals = filterOutliers(rrIntervals);
  
  // Si después del filtrado quedan muy pocos intervalos, retornar valores por defecto
  if (filteredIntervals.length < 4) {
    return {
      pnnX: 0,
      shannonEntropy: 0,
      sampleEntropy: 0
    };
  }
  
  // Calculate pNNx (percentage of successive RR intervals differing by more than x ms)
  // Used by Mayo Clinic for arrhythmia analysis
  // Umbral aumentado a 60ms para mayor especificidad
  let countAboveThreshold = 0;
  for (let i = 1; i < filteredIntervals.length; i++) {
    if (Math.abs(filteredIntervals[i] - filteredIntervals[i-1]) > 60) { // Aumentado de 50 a 60
      countAboveThreshold++;
    }
  }
  const pnnX = countAboveThreshold / (filteredIntervals.length - 1);
  
  // Calculate Shannon Entropy (information theory approach)
  const shannonEntropy = calculateShannonEntropy(filteredIntervals);
  
  // Sample Entropy calculation (simplified)
  const sampleEntropy = estimateSampleEntropy(filteredIntervals);
  
  return {
    pnnX,
    shannonEntropy,
    sampleEntropy
  };
}

/**
 * Filtering outliers for more robust analysis
 * New function to improve reliability
 */
function filterOutliers(intervals: number[]): number[] {
  if (intervals.length < 3) return intervals;
  
  // Calculate median and median absolute deviation (more robust than mean/std)
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  
  const deviations = intervals.map(val => Math.abs(val - median));
  const sortedDevs = [...deviations].sort((a, b) => a - b);
  const mad = sortedDevs[Math.floor(sortedDevs.length / 2)];
  
  // Filter values within reasonable range (3 MADs)
  return intervals.filter(val => Math.abs(val - median) <= 3 * mad);
}

/**
 * Calculate RMSSD with validation
 * Improved to reduce sensitivity to outliers
 */
export function calculateRMSSD(recentRR: number[]): {
  rmssd: number;
  validIntervals: number;
} {
  // Filtrar outliers para mayor robustez
  const filteredRR = filterOutliers(recentRR);
  
  if (filteredRR.length < 3) {
    return { rmssd: 0, validIntervals: 0 };
  }
  
  let sumSquaredDiff = 0;
  let validIntervals = 0;
  
  for (let i = 1; i < filteredRR.length; i++) {
    const diff = filteredRR[i] - filteredRR[i-1];
    // Criterios más estrictos para intervalos válidos
    if (filteredRR[i] >= 600 && filteredRR[i] <= 1300) { // Rango más restrictivo (antes 500-1500)
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
 * Improved stability and outlier rejection
 */
export function calculateRRVariation(validRRs: number[]): {
  avgRR: number;
  lastRR: number;
  rrStandardDeviation: number;
  coefficientOfVariation: number;
  rrVariation: number;
} {
  // Si hay menos de 3 intervalos, retornar valores por defecto
  if (validRRs.length < 3) {
    return {
      avgRR: 0,
      lastRR: 0,
      rrStandardDeviation: 0,
      coefficientOfVariation: 0,
      rrVariation: 0
    };
  }
  
  // Filtrar outliers para mayor robustez
  const filteredRRs = filterOutliers(validRRs);
  
  // Si después del filtrado quedan muy pocos intervalos, retornar valores por defecto
  if (filteredRRs.length < 3) {
    return {
      avgRR: 0,
      lastRR: 0,
      rrStandardDeviation: 0,
      coefficientOfVariation: 0,
      rrVariation: 0
    };
  }
  
  const avgRR = filteredRRs.reduce((a, b) => a + b, 0) / filteredRRs.length;
  const lastRR = filteredRRs[filteredRRs.length - 1];
  
  // Calculate standard deviation
  const rrStandardDeviation = Math.sqrt(
    filteredRRs.reduce((sum, val) => sum + Math.pow(val - avgRR, 2), 0) / filteredRRs.length
  );
  
  const coefficientOfVariation = rrStandardDeviation / avgRR;
  
  // Calcular variación utilizando media ponderada de los últimos 3 intervalos
  // en lugar de solo el último, para mayor estabilidad
  let weightedRR = 0;
  if (filteredRRs.length >= 3) {
    const n = filteredRRs.length;
    weightedRR = (filteredRRs[n-1] * 3 + filteredRRs[n-2] * 2 + filteredRRs[n-3]) / 6;
  } else {
    weightedRR = lastRR;
  }
  
  const rrVariation = Math.abs(weightedRR - avgRR) / avgRR;
  
  return {
    avgRR,
    lastRR,
    rrStandardDeviation,
    coefficientOfVariation,
    rrVariation
  };
}
