
/**
 * Signal quality evaluation utilities
 * Provides functions for assessing signal quality and reliability
 */

import { findPeaksAndValleys } from './peak-detection';
import { calculateDC, calculateStandardDeviation } from './statistics';
import { SIGNAL_CONSTANTS } from './constants';

/**
 * Evaluador de calidad de señal básico
 */
export function evaluateSignalQuality(
  values: number[],
  minThreshold: number = SIGNAL_CONSTANTS.MIN_AMPLITUDE,
  peakThreshold: number = 0.3
): number {
  if (values.length < 30) return 0;
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  if (range < minThreshold) return 10; // Señal muy débil
  
  const mean = calculateDC(values);
  const stdDev = calculateStandardDeviation(values);
  const cv = stdDev / mean; // Coeficiente de variación
  
  // Analizar picos
  const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
  
  // Si no hay suficientes picos y valles, la señal probablemente no es buena
  if (peakIndices.length < 2 || valleyIndices.length < 2) return 30;
  
  // Regularidad entre picos (señal más regular = mejor calidad)
  let peakRegularity = 100;
  if (peakIndices.length >= 3) {
    const peakDiffs = [];
    for (let i = 1; i < peakIndices.length; i++) {
      peakDiffs.push(peakIndices[i] - peakIndices[i - 1]);
    }
    
    const avgDiff = peakDiffs.reduce((a, b) => a + b, 0) / peakDiffs.length;
    const diffVariation = peakDiffs.reduce((acc, diff) => 
      acc + Math.abs(diff - avgDiff), 0) / peakDiffs.length;
    
    // Normalizar variación como porcentaje del promedio
    const normalizedVariation = diffVariation / avgDiff;
    
    // Convertir a puntuación (menor variación = mayor puntuación)
    peakRegularity = 100 - (normalizedVariation * 100);
    peakRegularity = Math.max(0, Math.min(100, peakRegularity));
  }
  
  // Amplitud adecuada (ni demasiado grande ni demasiado pequeña)
  const amplitudeScore = range < peakThreshold ? 50 : 
                       range > 1.0 ? 60 : 
                       80;
  
  // Variabilidad adecuada (ni demasiado constante ni demasiado variable)
  const variabilityScore = cv < 0.05 ? 40 : 
                         cv > 0.5 ? 40 : 
                         90;
  
  // Combinar puntuaciones
  const qualityScore = (peakRegularity * 0.5) + (amplitudeScore * 0.3) + (variabilityScore * 0.2);
  
  return Math.min(100, qualityScore);
}
