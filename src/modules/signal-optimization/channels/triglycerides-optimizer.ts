
/**
 * Optimizador de señal para triglicéridos
 */

import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { OptimizedSignal, FeedbackData } from '../types';
import { ProcessedPPGSignal } from '../../signal-processing/types';

/**
 * Optimizador especializado para señales de triglicéridos
 */
export class TriglyceridesOptimizer extends BaseChannelOptimizer {
  constructor() {
    super('triglycerides', {
      amplification: 1.15,
      filterStrength: 0.65,
      sensitivity: 0.85,
      smoothing: 0.5,
      noiseThreshold: 0.18,
      dynamicRange: 0.75
    });
    
    // Buffer para tendencias de lípidos
    this._maxBufferSize = 200;
  }
  
  /**
   * Optimiza la señal para cálculo de triglicéridos
   */
  public optimize(signal: ProcessedPPGSignal): OptimizedSignal {
    // Amplificar señal
    const amplified = this.applyAdaptiveAmplification(signal.filteredValue);
    
    // Filtrar señal
    const filtered = this.applyAdaptiveFiltering(amplified);
    
    // Aplicar procesamiento específico para triglicéridos
    const optimized = this.applyTriglyceridesSpecificProcessing(filtered);
    
    // Actualizar estimación de ruido
    this.updateNoiseEstimate();
    
    // Calcular confianza
    const confidence = this.calculateConfidence(signal);
    
    // Limitar valor a rango [0,1]
    const normalizedValue = Math.max(0, Math.min(1, optimized));
    
    return {
      channel: 'triglycerides',
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
   * Aplica procesamiento específico para triglicéridos
   */
  private applyTriglyceridesSpecificProcessing(value: number): number {
    if (this.valueBuffer.length < 20) {
      return value;
    }
    
    // Suavizado de tendencia para lípidos con factor más alto que colesterol
    const alpha = 0.08; // Factor de suavizado muy bajo
    let smoothedValue = value;
    
    if (this.lastOptimizedValue !== 0) {
      smoothedValue = value * alpha + this.lastOptimizedValue * (1 - alpha);
    }
    
    // Para triglicéridos, enfatizar diferencias entre componentes espectrales
    const lastValues = this.valueBuffer.slice(-20);
    
    // Calcular diferencia entre valores pares e impares (estimación simple de componentes frecuenciales)
    let evenSum = 0, oddSum = 0;
    for (let i = 0; i < lastValues.length; i++) {
      if (i % 2 === 0) {
        evenSum += lastValues[i];
      } else {
        oddSum += lastValues[i];
      }
    }
    
    const evenAvg = evenSum / Math.ceil(lastValues.length / 2);
    const oddAvg = oddSum / Math.floor(lastValues.length / 2);
    
    // Diferencia entre componentes como indicador de absorción espectral
    const componentDiff = Math.abs(evenAvg - oddAvg);
    
    // Enfatizar valor basado en diferencia de componentes
    const emphasisFactor = 1 + (componentDiff * 0.5);
    smoothedValue = smoothedValue * emphasisFactor;
    
    // Guardar valor para próxima iteración
    this.lastOptimizedValue = smoothedValue;
    
    return smoothedValue;
  }
  
  /**
   * Procesa retroalimentación del calculador
   */
  public processFeedback(feedback: FeedbackData): void {
    if (feedback.channel !== 'triglycerides') return;
    
    // Escala de ajuste según magnitud
    const adjustmentScale = feedback.magnitude * 0.1;
    
    switch (feedback.adjustment) {
      case 'increase':
        // Incrementar filtrado para estabilizar
        this.parameters.filterStrength = Math.min(0.9, this.parameters.filterStrength * (1 + adjustmentScale * 0.4));
        
        // Incrementar suavizado para enfatizar tendencia
        this.parameters.smoothing = Math.min(0.75, this.parameters.smoothing * (1 + adjustmentScale * 0.3));
        break;
        
      case 'decrease':
        // Reducir filtrado para captar más variaciones
        this.parameters.filterStrength = Math.max(0.4, this.parameters.filterStrength * (1 - adjustmentScale * 0.4));
        
        // Reducir suavizado
        this.parameters.smoothing = Math.max(0.25, this.parameters.smoothing * (1 - adjustmentScale * 0.3));
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
