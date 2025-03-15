
/**
 * Analizador avanzado de Variabilidad de Frecuencia Cardíaca (HRV)
 * que implementa métricas estándar y no lineales.
 */

import { HRVMetrics, TimeMetrics, FrequencyMetrics, NonlinearMetrics } from '../types/HRVTypes';
import { HRVTimeMetrics } from './utils/HRVTimeMetrics';
import { HRVFrequencyMetrics } from './utils/HRVFrequencyMetrics';
import { HRVNonlinearMetrics } from './utils/HRVNonlinearMetrics';
import { RRIntervalUtils } from './utils/RRIntervalUtils';

// Change the export to 'export type' to fix the TypeScript error
export type { HRVMetrics };

export class HRVAnalyzer {
  private rrHistory: number[] = [];
  private readonly MAX_HISTORY = 300;  // ~5 minutos de historia
  private lastMetrics: HRVMetrics | null = null;
  
  constructor() {
    console.log('Analizador de HRV inicializado');
  }
  
  /**
   * Calcula métricas de HRV a partir de intervalos RR
   */
  public calculateMetrics(intervals: number[]): HRVMetrics {
    // Añadir nuevos intervalos al historial
    this.appendIntervals(intervals);
    
    if (this.rrHistory.length < 5) {
      return this.getDefaultMetrics();
    }
    
    // Eliminar valores atípicos (outliers)
    const filteredIntervals = RRIntervalUtils.removeOutliers(this.rrHistory);
    
    if (filteredIntervals.length < 5) {
      return this.getDefaultMetrics();
    }
    
    try {
      // Calcular métricas en dominio del tiempo
      const timeMetrics = HRVTimeMetrics.calculateTimeMetrics(filteredIntervals);
      
      // Calcular métricas en dominio de frecuencia
      const frequencyMetrics = HRVFrequencyMetrics.calculateFrequencyMetrics(
        filteredIntervals, 
        timeMetrics.rmssd, 
        timeMetrics.sdnn
      );
      
      // Calcular métricas no lineales
      const nonlinearMetrics = HRVNonlinearMetrics.calculateNonlinearMetrics(
        filteredIntervals,
        timeMetrics.rmssd,
        timeMetrics.sdnn
      );
      
      const metrics: HRVMetrics = {
        ...timeMetrics,
        ...frequencyMetrics,
        ...nonlinearMetrics
      };
      
      this.lastMetrics = metrics;
      return metrics;
    } catch (error) {
      console.error('Error calculando métricas HRV:', error);
      return this.lastMetrics || this.getDefaultMetrics();
    }
  }
  
  /**
   * Añade nuevos intervalos RR al historial
   */
  private appendIntervals(intervals: number[]): void {
    for (const interval of intervals) {
      if (RRIntervalUtils.isValidInterval(interval)) {
        this.rrHistory.push(interval);
      }
    }
    
    // Mantener tamaño máximo del historial
    if (this.rrHistory.length > this.MAX_HISTORY) {
      this.rrHistory = this.rrHistory.slice(-this.MAX_HISTORY);
    }
  }
  
  /**
   * Retorna métricas por defecto
   */
  private getDefaultMetrics(): HRVMetrics {
    return {
      rmssd: 0,
      sdnn: 0,
      pnn50: 0,
      lf: 0,
      hf: 0,
      lfhf: 1,
      sd1: 0,
      sd2: 0,
      entropy: 0
    };
  }
  
  /**
   * Reinicia el analizador de HRV
   */
  public reset(fullReset: boolean = true): void {
    if (fullReset) {
      this.rrHistory = [];
      this.lastMetrics = null;
    } else {
      // Conservar algunos datos para continuidad
      this.rrHistory = this.rrHistory.slice(-50);
    }
  }
}
