
/**
 * Decision engine for arrhythmia detection based on multiple parameters
 * Configuración ultrasensible para detección de arritmias
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
 * Umbrales extremadamente sensibles para detectar cualquier variación
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
  
  // Intervalo mínimo entre arritmias muy reducido
  if (timeSinceLastArrhythmia < minArrhythmiaInterval / 2) {
    return false;
  }
  
  // Condiciones extremadamente sensibles - detectará casi cualquier variación
  return (
    // Primary condition: valores drásticamente reducidos
    (rmssd > 5 && // Extremadamente reducido para sensibilidad máxima
     rrVariation > 0.04 && // Extremadamente reducido 
     coefficientOfVariation > 0.03) || // Extremadamente reducido
    
    // Secondary condition: alta sensibilidad
    (shannonEntropy > 0.3 && // Extremadamente reducido 
     pnnX > 0.04 && // Extremadamente reducido
     coefficientOfVariation > 0.03 && // Extremadamente reducido
     sampleEntropy > 0.2) || // Extremadamente reducido
    
    // Extreme variation condition: sensibilidad extrema
    (rrVariation > 0.06 && // Extremadamente reducido
     coefficientOfVariation > 0.04 && // Extremadamente reducido
     sampleEntropy > 0.25 && // Extremadamente reducido
     shannonEntropy > 0.25) // Extremadamente reducido
  );
}
