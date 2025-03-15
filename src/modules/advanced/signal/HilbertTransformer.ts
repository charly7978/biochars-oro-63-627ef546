
/**
 * Implementación de la transformada de Hilbert para análisis de señales
 */

import type { HilbertResult } from '../types/HilbertHuangTypes';

export class HilbertTransformer {
  /**
   * Aplica la transformada de Hilbert (simplificada) para obtener señal analítica
   */
  public applyHilbert(signal: number[]): HilbertResult {
    // Implementación simplificada de transformada de Hilbert
    const hilbertSignal = this.simplifiedHilbert(signal);
    
    const amplitude: number[] = [];
    const phase: number[] = [];
    
    // Calcular amplitud y fase instantáneas
    for (let i = 0; i < signal.length; i++) {
      // Señal analítica = señal original + i * transformada Hilbert
      const real = signal[i];
      const imag = hilbertSignal[i];
      
      // Amplitud instantánea
      amplitude.push(Math.sqrt(real * real + imag * imag));
      
      // Fase instantánea
      phase.push(Math.atan2(imag, real));
    }
    
    return { amplitude, phase };
  }
  
  /**
   * Implementación simplificada de la transformada de Hilbert
   */
  private simplifiedHilbert(signal: number[]): number[] {
    // Una implementación real usaría FFT y desplazamiento de fase
    // Esta es una aproximación para dispositivos limitados
    const result = Array(signal.length).fill(0);
    
    // Kernel de Hilbert simplificado
    for (let i = 0; i < signal.length; i++) {
      for (let j = 0; j < signal.length; j++) {
        if (i !== j) {
          // Kernel de Hilbert: 1/(π(t-τ))
          result[i] += signal[j] / (Math.PI * (i - j));
        }
      }
    }
    
    return result;
  }
  
  /**
   * Calcula la frecuencia instantánea a partir de la fase
   */
  public calculateInstantaneousFrequency(phase: number[]): number[] {
    if (phase.length < 2) return [];
    
    const frequency: number[] = [];
    const samplingRate = 30; // Aproximado para PPG
    
    // Calcular derivada de la fase
    for (let i = 1; i < phase.length; i++) {
      let phaseDiff = phase[i] - phase[i-1];
      
      // Ajustar saltos de fase
      if (phaseDiff > Math.PI) phaseDiff -= 2 * Math.PI;
      if (phaseDiff < -Math.PI) phaseDiff += 2 * Math.PI;
      
      // Frecuencia = derivada de fase / (2π)
      frequency.push(phaseDiff * samplingRate / (2 * Math.PI));
    }
    
    return frequency;
  }
  
  /**
   * Estima la frecuencia dominante a partir de frecuencias instantáneas
   */
  public estimateDominantFrequency(instantFreq: number[]): number {
    if (instantFreq.length === 0) return 0;
    
    // Filtrar valores extremos
    const validFreq = instantFreq.filter(f => f >= 0.5 && f <= 3.0);
    
    if (validFreq.length === 0) return 0;
    
    // Calcular media de frecuencias válidas
    return validFreq.reduce((sum, f) => sum + f, 0) / validFreq.length;
  }
}
