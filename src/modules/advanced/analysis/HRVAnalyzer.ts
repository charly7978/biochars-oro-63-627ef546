
/**
 * Analizador avanzado de Variabilidad de Frecuencia Cardíaca (HRV)
 * que implementa métricas estándar y no lineales.
 */

export interface HRVMetrics {
  rmssd: number;       // Root Mean Square of Successive Differences
  sdnn: number;        // Standard Deviation of NN intervals
  pnn50: number;       // Proportion of NN50
  lf: number;          // Low Frequency power
  hf: number;          // High Frequency power
  lfhf: number;        // LF/HF ratio
  sd1: number;         // Poincaré plot standard deviation perpendicular to line of identity
  sd2: number;         // Poincaré plot standard deviation along line of identity
  entropy: number;     // Approximate entropy
}

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
    const filteredIntervals = this.removeOutliers(this.rrHistory);
    
    if (filteredIntervals.length < 5) {
      return this.getDefaultMetrics();
    }
    
    try {
      // Calcular métricas en dominio del tiempo
      const rmssd = this.calculateRMSSD(filteredIntervals);
      const sdnn = this.calculateSDNN(filteredIntervals);
      const pnn50 = this.calculatePNN50(filteredIntervals);
      
      // Calcular métricas en dominio de frecuencia
      const frequencyDomain = this.calculateFrequencyDomain(filteredIntervals);
      
      // Calcular métricas no lineales
      const poincare = this.calculatePoincareParameters(filteredIntervals);
      const entropy = this.calculateApproximateEntropy(filteredIntervals);
      
      const metrics: HRVMetrics = {
        rmssd,
        sdnn,
        pnn50,
        lf: frequencyDomain.lf,
        hf: frequencyDomain.hf,
        lfhf: frequencyDomain.lfhf,
        sd1: poincare.sd1,
        sd2: poincare.sd2,
        entropy
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
      if (interval >= 400 && interval <= 1500) { // Rango fisiológico
        this.rrHistory.push(interval);
      }
    }
    
    // Mantener tamaño máximo del historial
    if (this.rrHistory.length > this.MAX_HISTORY) {
      this.rrHistory = this.rrHistory.slice(-this.MAX_HISTORY);
    }
  }
  
  /**
   * Elimina valores atípicos (outliers) de los intervalos RR
   */
  private removeOutliers(intervals: number[]): number[] {
    if (intervals.length < 5) return intervals;
    
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const q1Index = Math.floor(sortedIntervals.length * 0.25);
    const q3Index = Math.floor(sortedIntervals.length * 0.75);
    
    const q1 = sortedIntervals[q1Index];
    const q3 = sortedIntervals[q3Index];
    
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return intervals.filter(val => val >= lowerBound && val <= upperBound);
  }
  
  /**
   * Calcula la raíz cuadrada del promedio de las diferencias cuadradas sucesivas (RMSSD)
   */
  private calculateRMSSD(intervals: number[]): number {
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
  private calculateSDNN(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const squaredDiffs = intervals.map(val => (val - mean) ** 2);
    
    return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / intervals.length);
  }
  
  /**
   * Calcula el porcentaje de intervalos consecutivos que difieren en más de 50ms (pNN50)
   */
  private calculatePNN50(intervals: number[]): number {
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
  
  /**
   * Calcula parámetros en el dominio de la frecuencia (simplificado)
   */
  private calculateFrequencyDomain(intervals: number[]): { lf: number; hf: number; lfhf: number } {
    if (intervals.length < 10) {
      return { lf: 0, hf: 0, lfhf: 1 };
    }
    
    // Implementación simplificada basada en estimaciones
    const rmssd = this.calculateRMSSD(intervals);
    const sdnn = this.calculateSDNN(intervals);
    
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
  
  /**
   * Calcula parámetros de Poincaré (SD1, SD2)
   */
  private calculatePoincareParameters(intervals: number[]): { sd1: number; sd2: number } {
    if (intervals.length < 2) {
      return { sd1: 0, sd2: 0 };
    }
    
    // Crear pares de intervalos consecutivos
    const pairs: { x: number; y: number }[] = [];
    for (let i = 0; i < intervals.length - 1; i++) {
      pairs.push({ x: intervals[i], y: intervals[i+1] });
    }
    
    // Calcular SD1 y SD2
    const rmssd = this.calculateRMSSD(intervals);
    const sdnn = this.calculateSDNN(intervals);
    
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
  private calculateApproximateEntropy(intervals: number[]): number {
    if (intervals.length < 10) return 0;
    
    // Implementación simplificada basada en la variabilidad
    const sdnn = this.calculateSDNN(intervals);
    const rmssd = this.calculateRMSSD(intervals);
    
    // Normalizar para rango de entropía aproximada típico (0-2)
    const irregularity = rmssd / sdnn;
    return Math.min(2, Math.max(0, irregularity * 1.5));
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
