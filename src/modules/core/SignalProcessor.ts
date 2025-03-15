
/**
 * NOTA IMPORTANTE: Este es un módulo de procesamiento de señales.
 * Las interfaces principales están en index.tsx y PPGSignalMeter.tsx que son INTOCABLES.
 */

import { applySMAFilter, calculatePerfusionIndex } from '../../utils/vitalSignsUtils';

export interface ProcessedSignal {
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  rawValue?: number;
}

export class SignalProcessor {
  private readonly BUFFER_SIZE = 300;
  private readonly SMA_WINDOW_SIZE = 5;
  private readonly QUALITY_THRESHOLD = 0.08; // Aumentado de 0.05 a 0.08 para reducir falsos positivos
  private readonly FINGER_DETECTION_THRESHOLD = 35; // Aumentado de 30 a 35
  
  private ppgValues: number[] = [];
  private smaBuffer: number[] = [];
  private lastProcessedTime: number = 0;
  private consecutiveFingerFrames: number = 0;
  private readonly MIN_FINGER_FRAMES = 5; // Aumentado de 3 a 5 para mayor estabilidad
  private readonly MAX_QUALITY_VARIANCE = 15; // Nuevo umbral para varianza de calidad
  private qualityHistory: number[] = []; // Historial de calidad para análisis de estabilidad
  private readonly QUALITY_HISTORY_SIZE = 10; // Tamaño del historial
  
  /**
   * Procesa una señal PPG (fotopletismografía) y devuelve valores filtrados y análisis
   * Versión recalibrada para reducir falsos positivos
   */
  public processSignal(value: number): ProcessedSignal {
    // Aplicar filtro SMA para suavizar la señal
    const { filteredValue, updatedBuffer } = applySMAFilter(value, this.smaBuffer, this.SMA_WINDOW_SIZE);
    this.smaBuffer = updatedBuffer;
    
    // Actualizar buffer de valores PPG
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > this.BUFFER_SIZE) {
      this.ppgValues.shift();
    }
    
    // Calcular calidad de la señal
    const quality = this.calculateSignalQuality(filteredValue);
    
    // Añadir al historial de calidad
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
    
    // Detección de dedo en el sensor con análisis de estabilidad
    let fingerDetected = false;
    
    if (quality > this.QUALITY_THRESHOLD && this.isQualityStable()) {
      this.consecutiveFingerFrames++;
      if (this.consecutiveFingerFrames >= this.MIN_FINGER_FRAMES) {
        fingerDetected = true;
      }
    } else {
      // Degradación gradual para evitar parpadeo
      this.consecutiveFingerFrames = Math.max(0, this.consecutiveFingerFrames - 2);
    }
    
    // Actualizar tiempo de procesamiento
    this.lastProcessedTime = Date.now();
    
    return {
      filteredValue,
      quality: quality * 100, // Normalizar a porcentaje
      fingerDetected,
      rawValue: value
    };
  }
  
  /**
   * Verifica si la calidad de la señal es estable
   * Nuevo método para reducir falsos positivos
   */
  private isQualityStable(): boolean {
    if (this.qualityHistory.length < 5) return false;
    
    // Obtener datos recientes
    const recentQuality = this.qualityHistory.slice(-5);
    
    // Calcular varianza
    const mean = recentQuality.reduce((sum, q) => sum + q, 0) / recentQuality.length;
    const variance = recentQuality.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / recentQuality.length;
    
    // Verificar tendencia (debe ser estable o creciente)
    const trend = recentQuality[recentQuality.length - 1] - recentQuality[0];
    
    // Calcular coeficiente de variación normalizado
    const coefficient = Math.sqrt(variance) / (mean > 0 ? mean : 0.001);
    
    // Señal estable: baja varianza, tendencia no negativa significativa
    return coefficient < 0.25 && trend > -0.01;
  }
  
  /**
   * Calcula la calidad de la señal PPG
   * Mejorado para clasificación más precisa
   */
  private calculateSignalQuality(value: number): number {
    if (this.ppgValues.length < 15) return 0; // Aumentado requisito de muestras
    
    // Usar los últimos 30 valores para el cálculo
    const recentValues = this.ppgValues.slice(-30);
    
    // Calcular AC y DC con método mejorado
    const sorted = [...recentValues].sort((a, b) => a - b);
    const lowerPercentile = sorted[Math.floor(sorted.length * 0.1)];
    const upperPercentile = sorted[Math.floor(sorted.length * 0.9)];
    
    // Usar percentiles para reducir sensibilidad a valores atípicos
    const ac = upperPercentile - lowerPercentile;
    const dc = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calcular índice de perfusión
    const perfusionIndex = calculatePerfusionIndex(ac, dc);
    
    // Aplicar factor de corrección fisiológica
    const physiologicalCorrection = this.calculatePhysiologicalFactor(recentValues);
    
    // Aplicar corrección de calidad basada en análisis morfológico
    const normalizedQuality = Math.min(1, perfusionIndex * 12 * physiologicalCorrection);
    
    return normalizedQuality;
  }
  
  /**
   * Nuevo método: factor de corrección basado en características fisiológicas
   */
  private calculatePhysiologicalFactor(values: number[]): number {
    if (values.length < 20) return 1.0;
    
    // Calcular frecuencia aproximada de la señal mediante cruce por cero
    let crossings = 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    for (let i = 1; i < values.length; i++) {
      if ((values[i] - mean) * (values[i-1] - mean) < 0) {
        crossings++;
      }
    }
    
    // Calcular frecuencia aproximada en Hz
    const approxFrequency = (crossings / 2) * (30 / values.length);
    
    // Factor de ajuste basado en rango fisiológico (0.5Hz - 3Hz para ritmo cardíaco)
    let frequencyFactor = 1.0;
    
    if (approxFrequency < 0.5 || approxFrequency > 3.0) {
      // Fuera del rango fisiológico esperado, penalizar
      frequencyFactor = 0.7;
    } else if (approxFrequency >= 0.8 && approxFrequency <= 2.0) {
      // Dentro del rango óptimo, premiar
      frequencyFactor = 1.3;
    }
    
    // Evaluar también regularidad (importante para señales cardíacas)
    let variations = [];
    for (let i = 1; i < values.length; i++) {
      variations.push(Math.abs(values[i] - values[i-1]));
    }
    
    // Calcular variación de las variaciones (menor = más regular)
    const varMean = variations.reduce((sum, v) => sum + v, 0) / variations.length;
    const varStdDev = Math.sqrt(
      variations.reduce((sum, v) => sum + Math.pow(v - varMean, 2), 0) / variations.length
    );
    
    // Factor de regularidad (señales fisiológicas son relativamente regulares)
    const regularityFactor = Math.min(1.3, Math.max(0.7, 1.2 - (varStdDev / varMean) * 0.5));
    
    // Combinar factores
    return frequencyFactor * regularityFactor;
  }
  
  /**
   * Obtiene los valores PPG actuales
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.ppgValues = [];
    this.smaBuffer = [];
    this.consecutiveFingerFrames = 0;
    this.qualityHistory = [];
  }
}
