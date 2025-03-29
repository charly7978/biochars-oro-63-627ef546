
/**
 * Optimizador especializado para el canal de frecuencia cardíaca
 */

import { ProcessedPPGSignal } from '../../signal-processing/types';
import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { FeedbackData, OptimizationParameters } from '../types';

/**
 * Parámetros específicos para optimización de frecuencia cardíaca
 */
const HEART_RATE_PARAMS: Partial<OptimizationParameters> = {
  // Enfocado en resaltar picos cardíacos
  amplificationFactor: 1.8,
  filterStrength: 0.6,
  frequencyRange: [0.6, 3.3], // ~35-200 BPM
  sensitivityFactor: 1.2,
  adaptiveThreshold: true
};

/**
 * Optimizador especializado para mejorar la detección de frecuencia cardíaca
 */
export class HeartRateOptimizer extends BaseChannelOptimizer {
  // Valores específicos para detección de picos
  private peakEnhancementFactor: number = 1.5;
  private valleySuppressionFactor: number = 0.8;
  private dynamicThresholdBuffer: number[] = [];
  
  constructor() {
    super('heartRate', HEART_RATE_PARAMS);
  }
  
  /**
   * Aplica optimizaciones específicas para frecuencia cardíaca
   * Enfocado en realzar picos para mejor detección de pulso
   */
  protected applyChannelSpecificOptimizations(signal: ProcessedPPGSignal): number {
    // 1. Filtrado adaptativo para reducir ruido
    let optimized = this.applyAdaptiveFilter(signal.filteredValue);
    
    // 2. Realce de picos para mejorar detección de latidos
    optimized = this.enhancePeaks(optimized);
    
    // 3. Filtrado de frecuencia para mantener solo el rango cardíaco
    optimized = this.applyFrequencyDomain(optimized, signal.timestamp);
    
    // 4. Amplificación adaptativa
    optimized = this.amplifySignal(optimized);
    
    return optimized;
  }
  
  /**
   * Realza picos y suprime valles para mejorar detección
   */
  private enhancePeaks(value: number): number {
    if (this.valueBuffer.length < 5) return value;
    
    // Detectar si es un posible pico
    const recent = this.valueBuffer.slice(-3);
    const isPotentialPeak = recent[1] >= recent[0] && recent[1] >= recent[2];
    const isPotentialValley = recent[1] <= recent[0] && recent[1] <= recent[2];
    
    // Realzar picos y suprimir valles
    if (isPotentialPeak) {
      return value * this.peakEnhancementFactor;
    } else if (isPotentialValley) {
      return value * this.valleySuppressionFactor;
    }
    
    return value;
  }
  
  /**
   * Aplica filtrado en dominio de frecuencia para mantener solo rango cardíaco
   */
  private applyFrequencyDomain(value: number, timestamp: number): number {
    // Implementación simplificada de filtro paso banda
    // En una implementación real se usaría FFT o filtros IIR/FIR más avanzados
    if (this.valueBuffer.length < 10) return value;
    
    // Actualizar buffer para análisis de frecuencia
    this.dynamicThresholdBuffer.push(value);
    if (this.dynamicThresholdBuffer.length > 30) {
      this.dynamicThresholdBuffer.shift();
    }
    
    // Estimación simple de frecuencia dominante
    const dominant = this.estimateDominantFrequency();
    
    // Atenuar señal si está fuera del rango de frecuencias cardíacas
    const [minFreq, maxFreq] = this.parameters.frequencyRange;
    if (dominant < minFreq || dominant > maxFreq) {
      return value * 0.8; // Atenuar señales fuera del rango cardíaco
    }
    
    return value;
  }
  
  /**
   * Estima la frecuencia dominante en la señal
   */
  private estimateDominantFrequency(): number {
    if (this.dynamicThresholdBuffer.length < 10) return 1.0;
    
    // Análisis simplificado de autocorrelación
    const signal = [...this.dynamicThresholdBuffer];
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    const normalized = signal.map(v => v - mean);
    
    // Buscar período por autocorrelación
    let maxCorr = 0;
    let period = 10; // Valor por defecto (~3Hz/180BPM)
    
    for (let lag = 5; lag < Math.min(20, normalized.length/2); lag++) {
      let corr = 0;
      for (let i = 0; i < normalized.length - lag; i++) {
        corr += normalized[i] * normalized[i + lag];
      }
      corr /= (normalized.length - lag);
      
      if (corr > maxCorr) {
        maxCorr = corr;
        period = lag;
      }
    }
    
    // Convertir período a frecuencia estimada (asumiendo ~30fps)
    const estimatedFreq = 30 / period;
    return estimatedFreq;
  }
  
  /**
   * Procesamiento especializado de feedback para frecuencia cardíaca
   */
  protected adaptToFeedback(feedback: FeedbackData): void {
    super.adaptToFeedback(feedback);
    
    // Ajustes específicos para frecuencia cardíaca
    if (feedback.confidence < 0.3) {
      // Con baja confianza, aumentar realce de picos
      this.peakEnhancementFactor = Math.min(2.0, this.peakEnhancementFactor * 1.1);
    } else if (feedback.confidence > 0.8) {
      // Con alta confianza, estabilizar
      this.peakEnhancementFactor = 1.5; // Valor óptimo
    }
  }
  
  /**
   * Reinicia parámetros específicos
   */
  protected resetChannelParameters(): void {
    super.resetChannelParameters();
    this.setParameters(HEART_RATE_PARAMS);
    this.peakEnhancementFactor = 1.5;
    this.valleySuppressionFactor = 0.8;
    this.dynamicThresholdBuffer = [];
  }
}
