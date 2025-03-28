
/**
 * Optimizador de señal para glucosa
 */

import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { OptimizedSignal, FeedbackData } from '../types';
import { ProcessedPPGSignal } from '../../signal-processing/types';

/**
 * Optimizador especializado para señales de glucosa
 */
export class GlucoseOptimizer extends BaseChannelOptimizer {
  constructor() {
    super('glucose', {
      amplification: 1.2,
      filterStrength: 0.65,
      sensitivity: 1.1,
      smoothing: 0.4,
      noiseThreshold: 0.12,
      dynamicRange: 0.9
    });
    
    // Buffer más grande para tendencias lentas de glucosa
    this._maxBufferSize = 180;
  }
  
  /**
   * Optimiza la señal para cálculo de glucosa
   */
  public optimize(signal: ProcessedPPGSignal): OptimizedSignal {
    // Amplificar señal
    const amplified = this.applyAdaptiveAmplification(signal.filteredValue);
    
    // Filtrar señal
    const filtered = this.applyAdaptiveFiltering(amplified);
    
    // Aplicar filtrado adicional específico para glucosa
    const optimized = this.applyGlucoseSpecificProcessing(filtered);
    
    // Actualizar estimación de ruido
    this.updateNoiseEstimate();
    
    // Calcular confianza
    const confidence = this.calculateConfidence(signal);
    
    // Limitar valor a rango [0,1]
    const normalizedValue = Math.max(0, Math.min(1, optimized));
    
    return {
      channel: 'glucose',
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
   * Aplica procesamiento específico para glucosa
   */
  private applyGlucoseSpecificProcessing(value: number): number {
    if (this.valueBuffer.length < 30) {
      return value;
    }
    
    // Aplicar suavizado exponencial con mayor peso a tendencias
    const alpha = 0.15; // Factor de suavizado bajo para tendencias lentas
    const smoothed = value * alpha + this.lastOptimizedValue * (1 - alpha);
    
    // Detección y corrección de desviaciones rápidas (posible ruido)
    const recentValues = this.valueBuffer.slice(-30);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const maxDeviation = 0.15;
    
    let correctedValue = smoothed;
    if (Math.abs(smoothed - avgValue) > maxDeviation) {
      // Limitar desviación respecto a promedio reciente
      correctedValue = avgValue + Math.sign(smoothed - avgValue) * maxDeviation;
    }
    
    // Guardar valor para siguiente iteración
    this.lastOptimizedValue = correctedValue;
    
    return correctedValue;
  }
  
  /**
   * Procesa retroalimentación del calculador
   */
  public processFeedback(feedback: FeedbackData): void {
    if (feedback.channel !== 'glucose') return;
    
    // Escala de ajuste según magnitud
    const adjustmentScale = feedback.magnitude * 0.2;
    
    switch (feedback.adjustment) {
      case 'increase':
        // Incrementar amplificación
        this.parameters.amplification *= (1 + adjustmentScale);
        
        // Reducir suavizado
        this.parameters.smoothing = Math.max(0.1, this.parameters.smoothing * (1 - adjustmentScale * 0.5));
        break;
        
      case 'decrease':
        // Reducir amplificación
        this.parameters.amplification *= (1 - adjustmentScale);
        
        // Incrementar filtrado
        this.parameters.filterStrength = Math.min(0.9, this.parameters.filterStrength * (1 + adjustmentScale * 0.5));
        break;
        
      case 'fine-tune':
        // Ajustar parámetro específico si se proporciona
        if (feedback.parameter) {
          const param = feedback.parameter as keyof typeof this.parameters;
          if (this.parameters[param] !== undefined) {
            // Aplicar pequeño ajuste en dirección positiva (asumiendo mejora)
            this.parameters[param] = this.parameters[param] * (1 + adjustmentScale * 0.1);
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
