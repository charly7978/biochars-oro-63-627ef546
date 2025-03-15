
/**
 * Calculator for heart rate variability metrics con máxima sensibilidad
 * Con umbrales muy bajos para mostrar más variabilidad
 */

import { NonLinearMetrics } from '../types/arrhythmia-types';
import { calculateShannonEntropy, estimateSampleEntropy } from './entropy-utils';

/**
 * Calculate advanced non-linear HRV metrics
 * Con validación mínima de intervalos
 */
export function calculateNonLinearMetrics(rrIntervals: number[]): NonLinearMetrics {
  // Requiere muy pocos intervalos
  if (rrIntervals.length < 2) {
    return {
      pnnX: 0,
      shannonEntropy: 0,
      sampleEntropy: 0
    };
  }
  
  // Filtrado más permisivo de outliers
  const filteredIntervals = filterOutliers(rrIntervals);
  
  // Requiere muy pocos intervalos
  if (filteredIntervals.length < 2) {
    return {
      pnnX: 0,
      shannonEntropy: 0,
      sampleEntropy: 0
    };
  }
  
  // Calculate pNNx con umbral más bajo
  let countAboveThreshold = 0;
  for (let i = 1; i < filteredIntervals.length; i++) {
    if (Math.abs(filteredIntervals[i] - filteredIntervals[i-1]) > 20) { // Umbral muy bajo (20ms)
      countAboveThreshold++;
    }
  }
  const pnnX = countAboveThreshold / (filteredIntervals.length - 1);
  
  // Calculate Shannon Entropy
  const shannonEntropy = calculateShannonEntropy(filteredIntervals);
  
  // Sample Entropy calculation
  const sampleEntropy = estimateSampleEntropy(filteredIntervals);
  
  return {
    pnnX,
    shannonEntropy,
    sampleEntropy
  };
}

/**
 * Filtering outliers con criterio muy amplio
 */
function filterOutliers(intervals: number[]): number[] {
  if (intervals.length < 2) return intervals;
  
  // Calculate median and median absolute deviation
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  
  const deviations = intervals.map(val => Math.abs(val - median));
  const sortedDevs = [...deviations].sort((a, b) => a - b);
  const mad = sortedDevs[Math.floor(sortedDevs.length / 2)];
  
  // Filtro con 8 MADs - extremadamente permisivo
  return intervals.filter(val => Math.abs(val - median) <= 8 * mad);
}

/**
 * Calcula RMSSD con validación mínima
 */
export function calculateRMSSD(recentRR: number[]): {
  rmssd: number;
  validIntervals: number;
} {
  // Filtrado permisivo
  const filteredRR = filterOutliers(recentRR);
  
  if (filteredRR.length < 2) {
    return { rmssd: 0, validIntervals: 0 };
  }
  
  let sumSquaredDiff = 0;
  let validIntervals = 0;
  
  for (let i = 1; i < filteredRR.length; i++) {
    const diff = filteredRR[i] - filteredRR[i-1];
    // Criterios extremadamente permisivos
    if (filteredRR[i] >= 300 && filteredRR[i] <= 2000) { // Rango muy ampliado
      sumSquaredDiff += diff * diff;
      validIntervals++;
    }
  }
  
  const rmssd = validIntervals > 0 ? 
    Math.sqrt(sumSquaredDiff / validIntervals) : 0;
    
  return { rmssd, validIntervals };
}

/**
 * Calcula variación RR con criterios mínimos
 */
export function calculateRRVariation(validRRs: number[]): {
  avgRR: number;
  lastRR: number;
  rrStandardDeviation: number;
  coefficientOfVariation: number;
  rrVariation: number;
} {
  if (validRRs.length < 2) {
    return {
      avgRR: 0,
      lastRR: 0,
      rrStandardDeviation: 0,
      coefficientOfVariation: 0,
      rrVariation: 0
    };
  }
  
  // Filtrado permisivo
  const filteredRRs = filterOutliers(validRRs);
  
  if (filteredRRs.length < 2) {
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
  
  // Cálculo simplificado de variación
  const rrVariation = Math.abs(lastRR - avgRR) / avgRR;
  
  return {
    avgRR,
    lastRR,
    rrStandardDeviation,
    coefficientOfVariation,
    rrVariation
  };
}
