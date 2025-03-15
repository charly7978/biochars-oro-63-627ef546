
/**
 * Decision engine for arrhythmia detection based on multiple parameters
 * Based on cutting-edge research from leading cardiac centers
 * Recalibrated to reduce false positives
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
 * Recalibrated to reduce falsos positivos
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
  
  // Ensure minimum time between arrhythmia detections - aumentado para reducir falsos positivos
  if (timeSinceLastArrhythmia < minArrhythmiaInterval * 1.5) {
    return false;
  }
  
  // Multi-parametric decision algorithm with more conservative thresholds
  return (
    // Primary condition: requires multiple criteria to be met with stricter thresholds
    (rmssd > 50 && // Aumentado de 45 a 50
     rrVariation > 0.3 && // Aumentado de 0.25 a 0.3 
     coefficientOfVariation > 0.18) || // Aumentado de 0.15 a 0.18
    
    // Secondary condition: requires very strong signal quality and more definitive indicators
    (shannonEntropy > 2.0 && // Aumentado de 1.8 a 2.0
     pnnX > 0.3 && // Aumentado de 0.25 a 0.3
     coefficientOfVariation > 0.25 && // Aumentado de 0.2 a 0.25
     sampleEntropy > 1.2) || // Nuevo criterio adicional
    
    // Extreme variation condition: requires multiple confirmations - más restrictivo
    (rrVariation > 0.4 && // Aumentado de 0.35 a 0.4
     coefficientOfVariation > 0.3 && // Aumentado de 0.25 a 0.3
     sampleEntropy > 1.5 && // Aumentado de 1.4 a 1.5
     shannonEntropy > 1.7) // Nuevo criterio adicional
  );
}
