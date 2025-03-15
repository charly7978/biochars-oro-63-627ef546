
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
  private readonly QUALITY_THRESHOLD = 0.15; // Aumentado significativamente para reducir falsos positivos
  private readonly FINGER_DETECTION_THRESHOLD = 50; // Umbral mucho más alto
  
  private ppgValues: number[] = [];
  private smaBuffer: number[] = [];
  private lastProcessedTime: number = 0;
  private consecutiveFingerFrames: number = 0;
  private readonly MIN_FINGER_FRAMES = 8; // Exigimos más frames de confirmación
  private readonly MAX_QUALITY_VARIANCE = 8; // Umbral más estricto
  private qualityHistory: number[] = [];
  private readonly QUALITY_HISTORY_SIZE = 15; // Mayor historial para estabilidad
  private signalDiffHistory: number[] = []; // Nuevo: historial de cambios en la señal
  private readonly SIGNAL_DIFF_HISTORY_SIZE = 10;
  private readonly MIN_SIGNAL_VARIATION = 0.5; // Nuevo: requerimiento mínimo de variación
  
  /**
   * Procesa una señal PPG (fotopletismografía) y devuelve valores filtrados y análisis
   * Versión recalibrada para reducir drásticamente los falsos positivos
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
    
    // Actualizar historial de cambios en la señal (nueva lógica)
    if (this.ppgValues.length >= 2) {
      const diff = Math.abs(this.ppgValues[this.ppgValues.length - 1] - this.ppgValues[this.ppgValues.length - 2]);
      this.signalDiffHistory.push(diff);
      if (this.signalDiffHistory.length > this.SIGNAL_DIFF_HISTORY_SIZE) {
        this.signalDiffHistory.shift();
      }
    }
    
    // Detección de dedo en el sensor con análisis de estabilidad y variación
    let fingerDetected = false;
    
    if (quality > this.QUALITY_THRESHOLD && this.isQualityStable() && this.hasSignificantVariation()) {
      this.consecutiveFingerFrames++;
      if (this.consecutiveFingerFrames >= this.MIN_FINGER_FRAMES) {
        fingerDetected = true;
      }
    } else {
      // Degradación rápida para evitar falsos positivos
      this.consecutiveFingerFrames = Math.max(0, this.consecutiveFingerFrames - 3);
    }
    
    // Log detallado para depuración
    if (this.ppgValues.length % 30 === 0) {
      console.log("SignalProcessor: Análisis de detección", {
        quality,
        threshold: this.QUALITY_THRESHOLD,
        estable: this.isQualityStable(),
        variacionSignificativa: this.hasSignificantVariation(),
        framesConsecutivos: this.consecutiveFingerFrames,
        framesRequeridos: this.MIN_FINGER_FRAMES,
        dedoDetectado: fingerDetected
      });
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
   * NUEVA FUNCIÓN: Verifica si hay variación significativa en la señal
   * Esto es crítico para distinguir un dedo real de objetos estáticos
   */
  private hasSignificantVariation(): boolean {
    if (this.signalDiffHistory.length < this.SIGNAL_DIFF_HISTORY_SIZE/2) {
      return false;
    }
    
    // Calcular variación promedio
    const avgVariation = this.signalDiffHistory.reduce((sum, diff) => sum + diff, 0) / this.signalDiffHistory.length;
    
    // Requerir variación mínima (un dedo real siempre muestra pulsaciones)
    const hasVariation = avgVariation > this.MIN_SIGNAL_VARIATION;
    
    // Verificar también periodicidad (característica clave de PPG real)
    const hasPeriodicPattern = this.detectPeriodicPattern();
    
    return hasVariation && hasPeriodicPattern;
  }
  
  /**
   * NUEVA FUNCIÓN: Detecta patrones periódicos típicos de pulsaciones cardíacas
   */
  private detectPeriodicPattern(): boolean {
    if (this.ppgValues.length < 30) return false;
    
    // Obtener valores recientes
    const recentValues = this.ppgValues.slice(-30);
    
    // Calcular autocorrelación simple (buscar periodicidad)
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    let maxCorrelation = 0;
    
    // Buscar correlaciones en diferentes intervalos (aproximadamente 40-180 BPM)
    for (let lag = 5; lag <= 15; lag++) {
      let correlation = 0;
      let n = 0;
      
      for (let i = 0; i < recentValues.length - lag; i++) {
        correlation += (recentValues[i] - mean) * (recentValues[i + lag] - mean);
        n++;
      }
      
      if (n > 0) {
        correlation /= n;
        maxCorrelation = Math.max(maxCorrelation, correlation);
      }
    }
    
    // Normalizar y verificar si hay suficiente correlación
    const variance = recentValues.reduce((sum, val) => sum + (val - mean) * (val - mean), 0) / recentValues.length;
    const normalizedCorrelation = variance > 0 ? maxCorrelation / variance : 0;
    
    return normalizedCorrelation > 0.2; // Umbral de correlación significativa
  }
  
  /**
   * Verifica si la calidad de la señal es estable
   * Método mejorado para detectar señales fisiológicas reales
   */
  private isQualityStable(): boolean {
    if (this.qualityHistory.length < 10) return false;
    
    // Obtener datos recientes
    const recentQuality = this.qualityHistory.slice(-10);
    
    // Calcular varianza
    const mean = recentQuality.reduce((sum, q) => sum + q, 0) / recentQuality.length;
    const variance = recentQuality.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / recentQuality.length;
    
    // Verificar tendencia (debe ser estable o creciente)
    const trend = recentQuality[recentQuality.length - 1] - recentQuality[0];
    
    // Calcular coeficiente de variación normalizado
    const coefficient = Math.sqrt(variance) / (mean > 0 ? mean : 0.001);
    
    // Señal estable: baja varianza, tendencia no negativa significativa
    return coefficient < 0.2 && trend > -0.01;
  }
  
  /**
   * Calcula la calidad de la señal PPG
   * Mejorado para clasificación más precisa y exigente
   */
  private calculateSignalQuality(value: number): number {
    if (this.ppgValues.length < 20) return 0; // Más datos requeridos
    
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
    // Umbral más estricto para calidad
    const normalizedQuality = Math.min(1, perfusionIndex * 10 * physiologicalCorrection);
    
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
