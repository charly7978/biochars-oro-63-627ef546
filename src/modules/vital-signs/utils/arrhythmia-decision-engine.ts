
/**
 * Decision engine for arrhythmia detection based on multiple parameters
 * Based on cutting-edge research from leading cardiac centers
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
 * with conservative thresholds for clinical reliability
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
  
  // Ensure minimum time between arrhythmia detections
  if (timeSinceLastArrhythmia < minArrhythmiaInterval) {
    return false;
  }
  
  // Multi-parametric decision algorithm with conservative thresholds
  return (
    // Primary condition: requires multiple criteria to be met
    (rmssd > 45 && 
     rrVariation > 0.25 && 
     coefficientOfVariation > 0.15) ||
    
    // Secondary condition: requires very strong signal quality
    (shannonEntropy > 1.8 && 
     pnnX > 0.25 && 
     coefficientOfVariation > 0.2) ||
    
    // Extreme variation condition: requires multiple confirmations
    (rrVariation > 0.35 && 
     coefficientOfVariation > 0.25 && 
     sampleEntropy > 1.4)
  );
}
