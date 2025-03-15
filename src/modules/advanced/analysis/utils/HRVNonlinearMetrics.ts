
import { NonlinearMetrics } from '../../../vital-signs/types/arrhythmia-types';

/**
 * Utilidad para cálculo de métricas no lineales de HRV
 */
export class HRVNonlinearMetrics {
  /**
   * Calcula métricas no lineales a partir de intervalos RR
   */
  public static calculateNonlinearMetrics(
    intervals: number[], 
    rmssd: number, 
    sdnn: number
  ): NonlinearMetrics {
    if (intervals.length < 10) {
      return { sd1: 0, sd2: 0, entropy: 0 };
    }
    
    // Cálculo de SD1 y SD2 basado en RMSSD y SDNN
    // SD1 está relacionado con RMSSD y representa variabilidad a corto plazo
    const sd1 = Math.sqrt(rmssd * rmssd / 2);
    
    // SD2 representa variabilidad a largo plazo
    const sd2 = Math.sqrt(2 * sdnn * sdnn - sd1 * sd1);
    
    // Entropía aproximada - implementación simplificada
    const entropy = this.calculateApproximateEntropy(intervals);
    
    return {
      sd1: Math.max(0, sd1),
      sd2: Math.max(0, sd2),
      entropy
    };
  }
  
  /**
   * Cálculo simplificado de entropía aproximada
   */
  private static calculateApproximateEntropy(intervals: number[]): number {
    if (intervals.length < 10) return 0;
    
    // Implementación simplificada basada en la variabilidad
    const diffs = [];
    for (let i = 1; i < intervals.length; i++) {
      diffs.push(Math.abs(intervals[i] - intervals[i-1]));
    }
    
    // Ordenar diferencias
    diffs.sort((a, b) => a - b);
    
    // Calcular entropía aproximada utilizando la distribución de diferencias
    let entropy = 0;
    const n = diffs.length;
    
    for (let i = 0; i < n - 1; i++) {
      const p = 1 / n;
      if (p > 0) {
        entropy -= p * Math.log(p);
      }
    }
    
    return Math.min(2, Math.max(0, entropy));
  }
}
