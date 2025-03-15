
/**
 * Decision engine for arrhythmia detection based on multiple parameters
 * Based on cutting-edge research from leading cardiac centers
 * Recalibrated for better detection sensitivity
 */

import { NonLinearMetrics } from '../types/arrhythmia-types';

interface ArrhythmiaDecisionParams {
  rmssd: number;
  rrVariation: number;
  coefficientOfVariation: number;
  timeSinceLastArrhythmia: number;
  minArrhythmiaInterval: number;
  nonLinearMetrics: NonLinearMetrics;
}

/**
 * Multi-parametric decision algorithm for arrhythmia detection
 * with balanced thresholds for clinical reliability
 * Recalibrated to improve detection sensitivity
 */
export function detectArrhythmia(params: ArrhythmiaDecisionParams): boolean {
  const {
    rmssd, 
    rrVariation, 
    coefficientOfVariation,
    timeSinceLastArrhythmia,
    minArrhythmiaInterval,
    nonLinearMetrics
  } = params;
  
  const { shannonEntropy, sampleEntropy, pnnX } = nonLinearMetrics;
  
  // Ensure minimum time between arrhythmia detections - reducido para mejorar detección
  if (timeSinceLastArrhythmia < minArrhythmiaInterval) {
    return false;
  }
  
  // Multi-parametric decision algorithm with more sensitive thresholds
  return (
    // Primary condition: requires multiple criteria to be met with balanced thresholds
    (rmssd > 40 && // Reducido de 45 a 40
     rrVariation > 0.20 && // Reducido de 0.25 a 0.20 
     coefficientOfVariation > 0.12) || // Reducido de 0.15 a 0.12
    
    // Secondary condition: requires good signal quality but more sensitive indicators
    (shannonEntropy > 1.6 && // Reducido de 1.8 a 1.6
     pnnX > 0.20 && // Reducido de 0.25 a 0.20
     coefficientOfVariation > 0.18 && // Reducido de 0.2 a 0.18
     sampleEntropy > 0.9) || // Reducido de 1.1 a 0.9
    
    // Extreme variation condition: more sensitive detection
    (rrVariation > 0.30 && // Reducido de 0.35 a 0.30
     coefficientOfVariation > 0.22 && // Reducido de 0.25 a 0.22
     sampleEntropy > 1.2 && // Reducido de 1.4 a 1.2
     shannonEntropy > 1.4) // Reducido de 1.6 a 1.4
  );
}
