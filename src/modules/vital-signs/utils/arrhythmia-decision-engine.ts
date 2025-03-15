
/**
 * Motor de decisión para detección de arritmias basado en múltiples parámetros
 * Configuración sensible pero realista para detección clínicamente relevante
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
 * Algoritmo de decisión multiparamétrico para detección de arritmias
 * Utiliza umbrales basados en literatura científica y estándares médicos
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
  
  // Respetar intervalo mínimo entre arritmias para evitar falsos positivos
  if (timeSinceLastArrhythmia < minArrhythmiaInterval) {
    return false;
  }
  
  // Umbrales basados en literatura médica para relevancia clínica
  return (
    // Condición primaria: variabilidad significativa + irregularidad
    (rmssd > 25 && // Umbral estándar en literatura médica
     rrVariation > 0.12 && // Variación significativa
     coefficientOfVariation > 0.1) || // Coeficiente de variación significativo
    
    // Condición secundaria: entropía elevada + variabilidad
    (shannonEntropy > 0.6 && // Entropía elevada indica irregularidad
     pnnX > 0.15 && // Proporción significativa de intervalos NN
     coefficientOfVariation > 0.08 && 
     sampleEntropy > 0.5) || // Entropía muestral elevada
    
    // Condición de variación extrema: claramente patológica
    (rrVariation > 0.2 && // Variación muy alta
     coefficientOfVariation > 0.15 && 
     sampleEntropy > 0.7 && 
     shannonEntropy > 0.65)
  );
}
