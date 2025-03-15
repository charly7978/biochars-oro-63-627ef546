
import { FrequencyMetrics } from '../../../vital-signs/types/arrhythmia-types';

/**
 * Utilidad para cálculo de métricas HRV en el dominio de la frecuencia
 */
export class HRVFrequencyMetrics {
  /**
   * Calcula parámetros en el dominio de la frecuencia
   */
  public static calculateFrequencyMetrics(intervals: number[], rmssd: number, sdnn: number): FrequencyMetrics {
    if (intervals.length < 10) {
      return { lf: 0, hf: 0, lfhf: 1 };
    }
    
    // Implementación simplificada basada en estimaciones
    
    // Aproximación de HF basada en RMSSD
    const hf = Math.pow(rmssd, 2) / 2;
    
    // Aproximación de LF basada en SDNN y RMSSD
    const lf = Math.pow(sdnn, 2) - Math.pow(rmssd, 2) / 2;
    
    // Ratio LF/HF
    const lfhf = hf > 0 ? lf / hf : 1;
    
    return {
      lf: Math.max(0, lf),
      hf: Math.max(0, hf),
      lfhf: Math.max(0.1, lfhf)
    };
  }
}
