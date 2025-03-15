
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
  if (timeSinceLastArrhythmia < minArrhythmiaInterval * 1.2) {
    return false;
  }
  
  // Multi-parametric decision algorithm with more sensitive thresholds
  return (
    // Primary condition: requires multiple criteria to be met with balanced thresholds
    (rmssd > 45 && // Reducido de 50 a 45
     rrVariation > 0.25 && // Reducido de 0.3 a 0.25 
     coefficientOfVariation > 0.15) || // Reducido de 0.18 a 0.15
    
    // Secondary condition: requires good signal quality but more sensitive indicators
    (shannonEntropy > 1.8 && // Reducido de 2.0 a 1.8
     pnnX > 0.25 && // Reducido de 0.3 a 0.25
     coefficientOfVariation > 0.2 && // Reducido de 0.25 a 0.2
     sampleEntropy > 1.1) || // Reducido de 1.2 a 1.1
    
    // Extreme variation condition: more sensitive detection
    (rrVariation > 0.35 && // Reducido de 0.4 a 0.35
     coefficientOfVariation > 0.25 && // Reducido de 0.3 a 0.25
     sampleEntropy > 1.4 && // Reducido de 1.5 a 1.4
     shannonEntropy > 1.6) // Reducido de 1.7 a 1.6
  );
}
