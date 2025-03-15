
import { TimeMetrics } from '../types/HRVTypes';

/**
 * Utilidad para cálculo de métricas HRV en el dominio del tiempo
 */
export class HRVTimeMetrics {
  /**
   * Calcula métricas en el dominio del tiempo a partir de intervalos RR
   */
  public static calculateTimeMetrics(intervals: number[]): TimeMetrics {
    if (intervals.length < 2) {
      return { rmssd: 0, sdnn: 0, pnn50: 0 };
    }
    
    return {
      rmssd: this.calculateRMSSD(intervals),
      sdnn: this.calculateSDNN(intervals),
      pnn50: this.calculatePNN50(intervals)
    };
  }
  
  /**
   * Calcula la raíz cuadrada del promedio de las diferencias cuadradas sucesivas (RMSSD)
   */
  private static calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sumSquaredDiffs = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiffs / (intervals.length - 1));
  }
  
  /**
   * Calcula la desviación estándar de intervalos RR (SDNN)
   */
  private static calculateSDNN(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const squaredDiffs = intervals.map(val => (val - mean) ** 2);
    
    return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / intervals.length);
  }
  
  /**
   * Calcula el porcentaje de intervalos consecutivos que difieren en más de 50ms (pNN50)
   */
  private static calculatePNN50(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let count = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = Math.abs(intervals[i] - intervals[i-1]);
      if (diff > 50) {
        count++;
      }
    }
    
    return (count / (intervals.length - 1)) * 100;
  }
}
