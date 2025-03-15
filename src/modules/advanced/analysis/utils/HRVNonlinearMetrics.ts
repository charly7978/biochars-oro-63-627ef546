
import { NonlinearMetrics } from '../types/HRVTypes';

/**
 * Utilidad para cálculo de métricas HRV no lineales
 */
export class HRVNonlinearMetrics {
  /**
   * Calcula métricas no lineales a partir de intervalos RR
   */
  public static calculateNonlinearMetrics(intervals: number[], rmssd: number, sdnn: number): NonlinearMetrics {
    return {
      ...this.calculatePoincareParameters(intervals, rmssd, sdnn),
      entropy: this.calculateApproximateEntropy(intervals, sdnn, rmssd)
    };
  }
  
  /**
   * Calcula parámetros de Poincaré (SD1, SD2)
   */
  private static calculatePoincareParameters(
    intervals: number[],
    rmssd: number,
    sdnn: number
  ): { sd1: number; sd2: number } {
    if (intervals.length < 2) {
      return { sd1: 0, sd2: 0 };
    }
    
    // SD1 relacionado con RMSSD
    const sd1 = rmssd / Math.sqrt(2);
    
    // SD2 calculado a partir de SDNN y SD1
    const sd2 = Math.sqrt(2 * Math.pow(sdnn, 2) - Math.pow(sd1, 2));
    
    return {
      sd1: Math.max(0, sd1),
      sd2: Math.max(0, sd2)
    };
  }
  
  /**
   * Calcula entropía aproximada (simplificada)
   */
  private static calculateApproximateEntropy(
    intervals: number[],
    sdnn: number,
    rmssd: number
  ): number {
    if (intervals.length < 10) return 0;
    
    // Implementación simplificada basada en la variabilidad
    
    // Normalizar para rango de entropía aproximada típico (0-2)
    const irregularity = rmssd / sdnn;
    return Math.min(2, Math.max(0, irregularity * 1.5));
  }
  
  /**
   * Calcula Shannon Entropy para RR intervals (método avanzado)
   */
  public static calculateShannonEntropy(intervals: number[]): number {
    if (intervals.length < 5) return 0;
    
    // Simplified histogram-based entropy calculation
    const bins: {[key: string]: number} = {};
    const binWidth = 25; // 25ms bin width
    
    intervals.forEach(interval => {
      const binKey = Math.floor(interval / binWidth);
      bins[binKey] = (bins[binKey] || 0) + 1;
    });
    
    let entropy = 0;
    const totalPoints = intervals.length;
    
    Object.values(bins).forEach(count => {
      const probability = count / totalPoints;
      entropy -= probability * Math.log2(probability);
    });
    
    return entropy;
  }
  
  /**
   * Estima Sample Entropy (implementación simplificada)
   */
  public static estimateSampleEntropy(intervals: number[]): number {
    if (intervals.length < 10) return 0;
    
    // Simplified sample entropy estimation
    const normalizedIntervals = intervals.map(interval => 
      (interval - intervals.reduce((a, b) => a + b, 0) / intervals.length) / 
      Math.max(1, Math.sqrt(intervals.reduce((a, b) => a + Math.pow(b, 2), 0) / intervals.length))
    );
    
    let sumCorr = 0;
    for (let i = 0; i < normalizedIntervals.length - 1; i++) {
      sumCorr += Math.abs(normalizedIntervals[i + 1] - normalizedIntervals[i]);
    }
    
    // Convert to entropy-like measure
    return -Math.log(sumCorr / (normalizedIntervals.length - 1));
  }
}
