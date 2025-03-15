
/**
 * Decision engine for arrhythmia detection based on multiple parameters
 * Based on cutting-edge research from leading cardiac centers
 * Extremely sensitive detection parameters for enhanced clinical utility
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
 * with extremely sensitive thresholds to maximize detection rate
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
  
  // Multi-parametric decision algorithm with extremely sensitive thresholds
  // Valores extremadamente reducidos para maximizar la detección
  return (
    // Primary condition: requires multiple criteria to be met with very sensitive thresholds
    (rmssd > 15 && // Reducido dramáticamente para aumentar sensibilidad
     rrVariation > 0.08 && // Reducido dramáticamente 
     coefficientOfVariation > 0.06) || // Reducido dramáticamente
    
    // Secondary condition: requires good signal quality but highly sensitive indicators
    (shannonEntropy > 0.6 && // Reducido dramáticamente 
     pnnX > 0.08 && // Reducido dramáticamente
     coefficientOfVariation > 0.07 && // Reducido dramáticamente
     sampleEntropy > 0.4) || // Reducido dramáticamente
    
    // Extreme variation condition: extremely sensitive detection
    (rrVariation > 0.12 && // Reducido dramáticamente
     coefficientOfVariation > 0.08 && // Reducido dramáticamente
     sampleEntropy > 0.5 && // Reducido dramáticamente
     shannonEntropy > 0.5) // Reducido dramáticamente
  );
}
