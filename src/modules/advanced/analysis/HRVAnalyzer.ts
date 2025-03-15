
/**
 * Analizador de la variabilidad de la frecuencia cardíaca (HRV)
 * 
 * Este módulo implementa algoritmos para calcular métricas de HRV
 * a partir de intervalos RR, útiles para la detección de arritmias
 * y evaluación del estado del sistema nervioso autónomo.
 */

/**
 * Métricas de variabilidad de la frecuencia cardíaca
 */
export interface HRVMetrics {
  rmssd: number;     // Root Mean Square of Successive Differences (ms)
  sdnn: number;      // Standard Deviation of NN intervals (ms)
  pnn50: number;     // % of NN intervals > 50ms different from preceding interval
  lf: number;        // Low Frequency Power (ms²)
  hf: number;        // High Frequency Power (ms²)
  lfHfRatio: number; // LF/HF Ratio (balance simpático/parasimpático)
  sdsd: number;      // Standard Deviation of Successive Differences (ms)
}

/**
 * Analizador de la variabilidad de la frecuencia cardíaca
 */
export class HRVAnalyzer {
  // Historial de intervalos RR para análisis a largo plazo
  private rrHistory: number[] = [];
  private readonly MAX_HISTORY = 300;
  
  // Configuración de filtrado de intervalos
  private readonly MIN_VALID_RR = 300;  // ms
  private readonly MAX_VALID_RR = 2000; // ms
  
  // Estado de calibración
  private calibrated: boolean = false;
  
  /**
   * Calcula métricas de HRV a partir de intervalos RR
   */
  public calculateMetrics(rrIntervals: number[]): HRVMetrics {
    // Si no hay suficientes intervalos, retornar valores por defecto
    if (!rrIntervals || rrIntervals.length < 3) {
      return this.getDefaultMetrics();
    }
    
    // Filtrar intervalos no válidos
    const validIntervals = rrIntervals.filter(
      rr => rr >= this.MIN_VALID_RR && rr <= this.MAX_VALID_RR
    );
    
    if (validIntervals.length < 3) {
      return this.getDefaultMetrics();
    }
    
    // Actualizar historial
    this.updateHistory(validIntervals);
    
    // Calcular métricas temporales
    const metrics = this.calculateTemporalMetrics(validIntervals);
    
    // Calcular métricas en dominio de frecuencia si hay suficientes datos
    if (this.rrHistory.length >= 30) {
      const frequencyMetrics = this.calculateFrequencyMetrics(this.rrHistory);
      metrics.lf = frequencyMetrics.lf;
      metrics.hf = frequencyMetrics.hf;
      metrics.lfHfRatio = frequencyMetrics.lfHfRatio;
    }
    
    return metrics;
  }
  
  /**
   * Actualiza el historial de intervalos RR
   */
  private updateHistory(newIntervals: number[]): void {
    // Añadir nuevos intervalos al historial
    this.rrHistory = [...this.rrHistory, ...newIntervals];
    
    // Limitar el tamaño del historial
    if (this.rrHistory.length > this.MAX_HISTORY) {
      this.rrHistory = this.rrHistory.slice(-this.MAX_HISTORY);
    }
  }
  
  /**
   * Calcula métricas temporales de HRV
   */
  private calculateTemporalMetrics(intervals: number[]): HRVMetrics {
    // Calcular SDNN (Desviación estándar de intervalos NN)
    const mean = intervals.reduce((sum, rr) => sum + rr, 0) / intervals.length;
    const sumSquaredDiffs = intervals.reduce((sum, rr) => sum + Math.pow(rr - mean, 2), 0);
    const sdnn = Math.sqrt(sumSquaredDiffs / intervals.length);
    
    // Calcular sucesivas diferencias
    const successiveDiffs: number[] = [];
    for (let i = 1; i < intervals.length; i++) {
      successiveDiffs.push(Math.abs(intervals[i] - intervals[i-1]));
    }
    
    // Calcular RMSSD (Root Mean Square of Successive Differences)
    const sumSquaredSuccessiveDiffs = successiveDiffs.reduce((sum, diff) => sum + Math.pow(diff, 2), 0);
    const rmssd = Math.sqrt(sumSquaredSuccessiveDiffs / successiveDiffs.length);
    
    // Calcular SDSD (Standard Deviation of Successive Differences)
    const meanDiff = successiveDiffs.reduce((sum, diff) => sum + diff, 0) / successiveDiffs.length;
    const sumSquaredDiffDiffs = successiveDiffs.reduce((sum, diff) => sum + Math.pow(diff - meanDiff, 2), 0);
    const sdsd = Math.sqrt(sumSquaredDiffDiffs / successiveDiffs.length);
    
    // Calcular pNN50 (Porcentaje de intervalos NN que difieren en más de 50ms)
    const countOver50ms = successiveDiffs.filter(diff => diff > 50).length;
    const pnn50 = (countOver50ms / successiveDiffs.length) * 100;
    
    // Utilizar valores por defecto para métricas de frecuencia
    // Se calcularán adecuadamente si hay suficientes datos en el historial
    return {
      rmssd,
      sdnn,
      pnn50,
      sdsd,
      lf: 500,
      hf: 300,
      lfHfRatio: 1.67
    };
  }
  
  /**
   * Calcula métricas en el dominio de la frecuencia usando FFT
   * (Simplificado para este ejemplo)
   */
  private calculateFrequencyMetrics(intervals: number[]): { lf: number, hf: number, lfHfRatio: number } {
    // En una implementación real, aquí se realizaría:
    // 1. Interpolación de los intervalos RR para obtener una señal equiespaciada
    // 2. Aplicación de ventana (ej. Hamming)
    // 3. Cálculo de la FFT
    // 4. Integración de la potencia en bandas LF (0.04-0.15 Hz) y HF (0.15-0.4 Hz)
    
    // Para simplificar, usaremos valores sintetizados basados en la variabilidad observada
    const variability = this.calculateVariabilityIndex(intervals);
    
    // Valores típicos de LF y HF basados en la variabilidad
    const lf = 400 + variability * 300;
    const hf = 200 + variability * 400;
    const lfHfRatio = lf / (hf || 1); // Evitar división por cero
    
    return { lf, hf, lfHfRatio };
  }
  
  /**
   * Calcula un índice de variabilidad general
   */
  private calculateVariabilityIndex(intervals: number[]): number {
    if (intervals.length < 2) return 0.5;
    
    // Calcular coeficiente de variación (CV = desviación estándar / media)
    const mean = intervals.reduce((sum, rr) => sum + rr, 0) / intervals.length;
    const sumSquaredDiffs = intervals.reduce((sum, rr) => sum + Math.pow(rr - mean, 2), 0);
    const stdDev = Math.sqrt(sumSquaredDiffs / intervals.length);
    const cv = stdDev / mean;
    
    // Normalizar a un rango [0,1]
    return Math.min(1, Math.max(0, cv * 5));
  }
  
  /**
   * Obtiene valores de métricas por defecto
   */
  private getDefaultMetrics(): HRVMetrics {
    return {
      rmssd: 30,
      sdnn: 50,
      pnn50: 5,
      lf: 500,
      hf: 300,
      lfHfRatio: 1.67,
      sdsd: 25
    };
  }
  
  /**
   * Reinicia el analizador
   */
  public reset(fullReset: boolean = true): void {
    if (fullReset) {
      this.rrHistory = [];
      this.calibrated = false;
    }
    
    console.log(`Analizador HRV reiniciado (${fullReset ? 'completo' : 'parcial'})`);
  }
}
