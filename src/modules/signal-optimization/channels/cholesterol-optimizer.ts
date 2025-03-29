
/**
 * Optimizador de señal para colesterol
 */

import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { OptimizedSignal, FeedbackData } from '../types';
import { ProcessedPPGSignal } from '../../signal-processing/types';

/**
 * Optimizador especializado para señales de colesterol
 */
export class CholesterolOptimizer extends BaseChannelOptimizer {
  constructor() {
    super('cholesterol', {
      amplification: 1.2,
      filterStrength: 0.7,
      sensitivity: 0.9,
      smoothing: 0.45,
      noiseThreshold: 0.15,
      dynamicRange: 0.8
    });
    
    // Buffer para tendencias de lípidos
    this._maxBufferSize = 200;
  }
  
  /**
   * Optimiza la señal para cálculo de colesterol
   */
  public optimize(signal: ProcessedPPGSignal): OptimizedSignal {
    // Amplificar señal
    const amplified = this.applyAdaptiveAmplification(signal.filteredValue);
    
    // Filtrar señal
    const filtered = this.applyAdaptiveFiltering(amplified);
    
    // Aplicar procesamiento específico para colesterol
    const optimized = this.applyCholesterolSpecificProcessing(filtered);
    
    // Actualizar estimación de ruido
    this.updateNoiseEstimate();
    
    // Calcular confianza
    const confidence = this.calculateConfidence(signal);
    
    // Limitar valor a rango [0,1]
    const normalizedValue = Math.max(0, Math.min(1, optimized));
    
    return {
      channel: 'cholesterol',
      timestamp: signal.timestamp,
      value: normalizedValue,
      rawValue: signal.rawValue,
      amplified: amplified,
      filtered: filtered,
      confidence: confidence,
      quality: signal.quality
    };
  }
  
  /**
   * Aplica procesamiento específico para colesterol
   */
  private applyCholesterolSpecificProcessing(value: number): number {
    if (this.valueBuffer.length < 20) {
      return value;
    }
    
    // Suavizado de tendencia para lípidos
    const alpha = 0.1; // Factor de suavizado bajo
    let smoothedValue = value;
    
    if (this.lastOptimizedValue !== 0) {
      smoothedValue = value * alpha + this.lastOptimizedValue * (1 - alpha);
    }
    
    // Enfatizar características específicas de absorción
    // Calcular densidad espectral aproximada
    const lastValues = this.valueBuffer.slice(-20);
    const meanValue = lastValues.reduce((sum, v) => sum + v, 0) / lastValues.length;
    
    // Calcular desviación respecto a media
    const deviation = value - meanValue;
    
    // Enfatizar desviaciones negativas (absorción característica)
    const emphasisFactor = 1.1;
    if (deviation < 0) {
      smoothedValue += deviation * (emphasisFactor - 1);
    }
    
    // Guardar valor para próxima iteración
    this.lastOptimizedValue = smoothedValue;
    
    return smoothedValue;
  }
  
  /**
   * Procesa retroalimentación del calculador
   */
  public processFeedback(feedback: FeedbackData): void {
    if (feedback.channel !== 'cholesterol') return;
    
    // Escala de ajuste según magnitud
    const adjustmentScale = feedback.magnitude * 0.1;
    
    switch (feedback.adjustment) {
      case 'increase':
        // Incrementar filtrado para estabilizar
        this.parameters.filterStrength = Math.min(0.85, this.parameters.filterStrength * (1 + adjustmentScale * 0.5));
        
        // Incrementar suavizado para enfatizar tendencia
        this.parameters.smoothing = Math.min(0.7, this.parameters.smoothing * (1 + adjustmentScale * 0.3));
        break;
        
      case 'decrease':
        // Reducir filtrado para captar más variaciones
        this.parameters.filterStrength = Math.max(0.4, this.parameters.filterStrength * (1 - adjustmentScale * 0.5));
        
        // Reducir suavizado
        this.parameters.smoothing = Math.max(0.2, this.parameters.smoothing * (1 - adjustmentScale * 0.3));
        break;
        
      case 'fine-tune':
        // Ajustar parámetro específico si se proporciona
        if (feedback.parameter) {
          const param = feedback.parameter as keyof typeof this.parameters;
          if (this.parameters[param] !== undefined) {
            const direction = feedback.confidence && feedback.confidence < 0.5 ? 1 : -1;
            this.parameters[param] = this.parameters[param] * (1 + direction * adjustmentScale * 0.1);
          }
        }
        break;
        
      case 'reset':
        // Restablecer parámetros por defecto
        this.reset();
        break;
    }
  }
}
