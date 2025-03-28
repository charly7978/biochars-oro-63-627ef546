
/**
 * Optimizador especializado para el canal de presión arterial
 */

import { ProcessedPPGSignal } from '../../signal-processing/types';
import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { FeedbackData, OptimizationParameters } from '../types';

/**
 * Parámetros específicos para optimización de presión arterial
 */
const BLOOD_PRESSURE_PARAMS: Partial<OptimizationParameters> = {
  // Enfocado en características de forma de onda
  amplificationFactor: 1.6,
  filterStrength: 0.65,
  frequencyRange: [0.6, 3.0],
  sensitivityFactor: 1.0,
  adaptiveThreshold: true
};

/**
 * Optimizador especializado para mejorar la detección de características
 * relacionadas con presión arterial
 */
export class BloodPressureOptimizer extends BaseChannelOptimizer {
  // Factores específicos para análisis de forma de onda
  private pulseTransitTime: number = 0;
  private waveformFeatures: Array<number> = [];
  private velocityEstimation: number = 0;
  
  constructor() {
    super('bloodPressure', BLOOD_PRESSURE_PARAMS);
  }
  
  /**
   * Aplica optimizaciones específicas para presión arterial
   * Enfocado en características de forma de onda y tiempo de tránsito
   */
  protected applyChannelSpecificOptimizations(signal: ProcessedPPGSignal): number {
    // 1. Filtrado adaptativo para reducir ruido
    let optimized = this.applyAdaptiveFilter(signal.filteredValue);
    
    // 2. Extraer características de forma de onda
    this.extractWaveformFeatures(optimized, signal.timestamp);
    
    // 3. Realce de características distintivas de presión
    optimized = this.enhancePressureFeatures(optimized);
    
    // 4. Amplificación adaptativa
    optimized = this.amplifySignal(optimized);
    
    return optimized;
  }
  
  /**
   * Extrae características de forma de onda relacionadas con presión
   */
  private extractWaveformFeatures(value: number, timestamp: number): void {
    if (this.valueBuffer.length < 10) {
      this.waveformFeatures = [];
      return;
    }
    
    // Detectar pendiente (relacionada con elasticidad arterial)
    const recent = this.valueBuffer.slice(-5);
    const slopeUp = recent[4] > recent[0] ? (recent[4] - recent[0]) / 4 : 0;
    
    // Detectar dicrótico (relacionado con resistencia periférica)
    let hasDicroticNotch = false;
    if (this.valueBuffer.length >= 15) {
      const segment = this.valueBuffer.slice(-15);
      // Análisis simplificado para detectar notch dicrótico
      for (let i = 5; i < segment.length - 2; i++) {
        if (segment[i] < segment[i-1] && segment[i] < segment[i+1]) {
          hasDicroticNotch = true;
          break;
        }
      }
    }
    
    // Estimar tiempo de pulso (relacionado con rigidez arterial)
    if (this.lastOptimizedValue < value && this.valueBuffer[this.valueBuffer.length-1] < value) {
      this.pulseTransitTime = timestamp - this.lastOptimizedValue;
      
      // Estimar velocidad basada en tiempo de tránsito (inversamente proporcional)
      if (this.pulseTransitTime > 0) {
        this.velocityEstimation = 1000 / this.pulseTransitTime; // Escala arbitraria
      }
    }
    
    // Almacenar características
    this.waveformFeatures = [slopeUp, hasDicroticNotch ? 1 : 0, this.velocityEstimation];
  }
  
  /**
   * Realza características relevantes para presión arterial
   */
  private enhancePressureFeatures(value: number): number {
    if (this.waveformFeatures.length < 3) return value;
    
    // Realzar pendientes pronunciadas (indicador de presión)
    const slopeEnhancement = this.waveformFeatures[0] * 0.2;
    
    // Realzar notch dicrótico si está presente
    const dicroticEnhancement = this.waveformFeatures[1] * 0.1;
    
    // Ajuste basado en tiempo de pulso estimado
    const velocityFactor = Math.min(0.15, this.waveformFeatures[2] * 0.01);
    
    // Aplicar enhancements
    return Math.max(0, Math.min(1, value + slopeEnhancement + dicroticEnhancement + velocityFactor));
  }
  
  /**
   * Procesamiento especializado de feedback para presión arterial
   */
  protected adaptToFeedback(feedback: FeedbackData): void {
    super.adaptToFeedback(feedback);
    
    // Adaptaciones específicas para presión arterial
    if (feedback.confidence < 0.4) {
      // Con baja confianza, ajustar para detectar mejor características de onda
      this.parameters.filterStrength = Math.min(0.75, this.parameters.filterStrength * 1.05);
    }
  }
  
  /**
   * Reinicia parámetros específicos
   */
  protected resetChannelParameters(): void {
    super.resetChannelParameters();
    this.setParameters(BLOOD_PRESSURE_PARAMS);
    this.pulseTransitTime = 0;
    this.waveformFeatures = [];
    this.velocityEstimation = 0;
  }
}
