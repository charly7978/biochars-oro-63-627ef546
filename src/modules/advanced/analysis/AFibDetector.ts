
/**
 * Detector avanzado de Fibrilación Auricular basado en el análisis
 * de irregularidades en los intervalos RR y patrones anormales.
 */

export interface AFibResult {
  detected: boolean;
  count: number;
  confidence: number;
  avgHR: number;
  timeInAFib: number;
}

export class AFibDetector {
  private intervalHistory: number[] = [];
  private afibEpisodes: number = 0;
  private lastDetectionTime: number = 0;
  private totalTimeInAFib: number = 0;
  private readonly BUFFER_SIZE = 20;
  private readonly MIN_INTERVALS = 6;
  
  constructor() {
    console.log('Detector de Fibrilación Auricular inicializado');
  }
  
  /**
   * Analiza los intervalos RR para detectar patrones de fibrilación auricular
   */
  public analyze(peakData: { peaks: number[]; intervals: number[] }): AFibResult {
    const { intervals } = peakData;
    
    if (intervals.length < this.MIN_INTERVALS) {
      return this.getDefaultResult();
    }
    
    // Añadir nuevos intervalos al historial
    for (const interval of intervals) {
      this.intervalHistory.push(interval);
      if (this.intervalHistory.length > this.BUFFER_SIZE) {
        this.intervalHistory.shift();
      }
    }
    
    if (this.intervalHistory.length < this.MIN_INTERVALS) {
      return this.getDefaultResult();
    }
    
    // Calcular métricas de variabilidad de intervalos RR
    const rmssd = this.calculateRMSSD();
    const pNN50 = this.calculatePNN50();
    const irregularity = this.calculateIrregularity();
    const variance = this.calculateVariance();
    
    // Promediar frecuencia cardíaca
    const avgInterval = this.intervalHistory.reduce((sum, val) => sum + val, 0) / this.intervalHistory.length;
    const avgHR = 60000 / avgInterval;
    
    // Detectar AFib basado en algoritmo multifactorial
    const isAFib = rmssd > 40 && pNN50 > 0.15 && irregularity > 0.2 && variance > 2500;
    
    // Actualizar contador de episodios
    const now = Date.now();
    if (isAFib && now - this.lastDetectionTime > 3000) { // Nuevo episodio después de 3 segundos
      this.afibEpisodes++;
      this.lastDetectionTime = now;
      this.totalTimeInAFib += 3;
    }
    
    // Calcular confianza de la detección
    const confidence = this.calculateConfidence(rmssd, pNN50, irregularity, variance);
    
    return {
      detected: isAFib,
      count: this.afibEpisodes,
      confidence,
      avgHR,
      timeInAFib: this.totalTimeInAFib
    };
  }
  
  /**
   * Calcula la raíz cuadrada del promedio de las diferencias cuadradas sucesivas (RMSSD)
   */
  private calculateRMSSD(): number {
    if (this.intervalHistory.length < 2) return 0;
    
    let sumSquaredDiffs = 0;
    for (let i = 1; i < this.intervalHistory.length; i++) {
      const diff = this.intervalHistory[i] - this.intervalHistory[i-1];
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiffs / (this.intervalHistory.length - 1));
  }
  
  /**
   * Calcula el porcentaje de intervalos consecutivos que difieren en más de 50ms
   */
  private calculatePNN50(): number {
    if (this.intervalHistory.length < 2) return 0;
    
    let count = 0;
    for (let i = 1; i < this.intervalHistory.length; i++) {
      const diff = Math.abs(this.intervalHistory[i] - this.intervalHistory[i-1]);
      if (diff > 50) {
        count++;
      }
    }
    
    return count / (this.intervalHistory.length - 1);
  }
  
  /**
   * Calcula la irregularidad de los intervalos RR
   */
  private calculateIrregularity(): number {
    if (this.intervalHistory.length < 6) return 0;
    
    const diffs: number[] = [];
    for (let i = 1; i < this.intervalHistory.length; i++) {
      diffs.push(Math.abs(this.intervalHistory[i] - this.intervalHistory[i-1]));
    }
    
    diffs.sort((a, b) => a - b);
    
    const median = diffs[Math.floor(diffs.length / 2)];
    const mad = diffs.reduce((sum, val) => sum + Math.abs(val - median), 0) / diffs.length;
    
    return mad / median;
  }
  
  /**
   * Calcula la varianza de los intervalos RR
   */
  private calculateVariance(): number {
    if (this.intervalHistory.length < 2) return 0;
    
    const mean = this.intervalHistory.reduce((sum, val) => sum + val, 0) / this.intervalHistory.length;
    const squaredDiffs = this.intervalHistory.map(val => (val - mean) ** 2);
    
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / this.intervalHistory.length;
  }
  
  /**
   * Calcula la confianza de la detección basada en múltiples parámetros
   */
  private calculateConfidence(rmssd: number, pNN50: number, irregularity: number, variance: number): number {
    const rmssdScore = Math.min(1, rmssd / 60);
    const pNN50Score = Math.min(1, pNN50 / 0.3);
    const irregularityScore = Math.min(1, irregularity / 0.4);
    const varianceScore = Math.min(1, variance / 5000);
    
    return (rmssdScore * 0.3 + pNN50Score * 0.3 + irregularityScore * 0.2 + varianceScore * 0.2) * 100;
  }
  
  /**
   * Resultado por defecto cuando no hay suficientes datos
   */
  private getDefaultResult(): AFibResult {
    return {
      detected: false,
      count: this.afibEpisodes,
      confidence: 0,
      avgHR: 0,
      timeInAFib: this.totalTimeInAFib
    };
  }
  
  /**
   * Reinicia el detector de AFib
   */
  public reset(fullReset: boolean = true): void {
    this.intervalHistory = [];
    
    if (fullReset) {
      this.afibEpisodes = 0;
      this.totalTimeInAFib = 0;
    }
    
    this.lastDetectionTime = 0;
  }
}
