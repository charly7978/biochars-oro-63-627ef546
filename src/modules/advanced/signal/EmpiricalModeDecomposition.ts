
/**
 * Implementación de la Descomposición en Modos Empíricos (EMD)
 * para la extracción de funciones de modo intrínseco (IMFs)
 */

import { IMF } from '../types/HilbertHuangTypes';
import { 
  findExtrema, 
  interpolate, 
  isMonotonic, 
  calculateAmplitude, 
  estimateFrequency 
} from './utils/SignalUtils';
import { HilbertTransformer } from './HilbertTransformer';

export class EmpiricalModeDecomposition {
  // Configuración
  private readonly MAX_ITERATIONS = 5;  // Máximo de iteraciones para extracción de IMF
  private readonly SIFTING_THRESHOLD = 0.05; // Umbral para detener proceso de sifting
  
  private hilbertTransformer: HilbertTransformer;
  
  constructor() {
    this.hilbertTransformer = new HilbertTransformer();
  }
  
  /**
   * Implementa la Descomposición en Modos Empíricos (EMD)
   * para extraer funciones de modo intrínseco (IMFs)
   */
  public performEMD(values: number[], maxImf: number): IMF[] {
    const imfs: IMF[] = [];
    let residual = [...values];
    
    // Extraer IMFs iterativamente
    for (let i = 0; i < maxImf && residual.length > 3; i++) {
      // Proceso de sifting para extraer IMF
      const imf = this.extractIMF(residual);
      
      // Si no se pudo extraer un IMF válido, terminar
      if (!imf) break;
      
      // Almacenar IMF
      imfs.push(imf);
      
      // Actualizar residual
      residual = residual.map((v, idx) => v - imf.values[idx]);
      
      // Si el residual es monótono, terminar
      if (isMonotonic(residual)) break;
    }
    
    return imfs;
  }
  
  /**
   * Extrae una función de modo intrínseco (IMF) mediante el proceso de sifting
   */
  private extractIMF(signal: number[]): IMF | null {
    let currentSignal = [...signal];
    let previousMean = Infinity;
    
    // Proceso iterativo de sifting
    for (let iter = 0; iter < this.MAX_ITERATIONS; iter++) {
      // Encontrar extremos
      const { maxIndices, minIndices } = findExtrema(currentSignal);
      
      // Si no hay suficientes extremos, no es posible extraer IMF
      if (maxIndices.length < 2 || minIndices.length < 2) {
        return null;
      }
      
      // Interpolar envoltorias superior e inferior
      const upperEnvelope = interpolate(maxIndices, currentSignal);
      const lowerEnvelope = interpolate(minIndices, currentSignal);
      
      // Calcular media de envoltorias
      const mean = upperEnvelope.map((u, i) => (u + lowerEnvelope[i]) / 2);
      
      // Calcular desviación media
      const meanDeviation = mean.reduce((sum, m) => sum + Math.abs(m), 0) / mean.length;
      
      // Criterio de parada: mean deviation no cambia significativamente
      if (Math.abs(meanDeviation - previousMean) / previousMean < this.SIFTING_THRESHOLD) {
        break;
      }
      
      previousMean = meanDeviation;
      
      // Actualizar señal restando la media
      currentSignal = currentSignal.map((v, i) => v - mean[i]);
    }
    
    // Calcular características del IMF
    const amplitude = calculateAmplitude(currentSignal);
    const frequency = estimateFrequency(currentSignal);
    const phase = this.calculatePhase(currentSignal);
    
    return {
      values: currentSignal,
      amplitude,
      frequency,
      phase
    };
  }
  
  /**
   * Calcula la fase instantánea utilizando la señal analítica
   */
  private calculatePhase(signal: number[]): number[] {
    // Transformada de Hilbert
    const hilbertResult = this.hilbertTransformer.applyHilbert(signal);
    return hilbertResult.phase;
  }
}
