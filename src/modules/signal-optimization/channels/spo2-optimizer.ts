
/**
 * Optimizador de señal para SpO2
 */

import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { OptimizedSignal, FeedbackData } from '../types';
import { ProcessedPPGSignal } from '../../signal-processing/types';

/**
 * Optimizador especializado para señales de SpO2
 */
export class SPO2Optimizer extends BaseChannelOptimizer {
  constructor() {
    super('spo2', {
      amplification: 1.3,
      filterStrength: 0.55,
      sensitivity: 1.1,
      smoothing: 0.25,
      noiseThreshold: 0.08,
      dynamicRange: 1.1
    });
    
    // Buffer para SpO2
    this._maxBufferSize = 60;
  }
  
  /**
   * Optimiza la señal para cálculo de SpO2
   */
  public override optimize(signal: ProcessedPPGSignal): OptimizedSignal {
    // Amplificar señal
    const amplified = this.applyAdaptiveAmplification(signal.filteredValue);
    
    // Filtrar señal
    const filtered = this.applyAdaptiveFiltering(amplified);
    
    // Actualizar buffer
    this.valueBuffer.push(filtered);
    if (this.valueBuffer.length > this._maxBufferSize) {
      this.valueBuffer.shift();
    }
    
    // Aplicar procesamiento específico para SpO2
    const optimized = this.applySPO2SpecificProcessing(filtered);
    
    // Actualizar estimación de ruido
    this.updateNoiseEstimate();
    
    // Calcular confianza
    const confidence = this.calculateConfidence(signal);
    
    // Guardar valor optimizado para siguiente iteración
    this.lastOptimizedValue = optimized;
    
    // Limitar valor a rango [0,1]
    const normalizedValue = Math.max(0, Math.min(1, optimized));
    
    return {
      channel: 'spo2',
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
   * Aplica procesamiento específico para SpO2
   */
  private applySPO2SpecificProcessing(value: number): number {
    if (this.valueBuffer.length < 10) {
      return value;
    }
    
    // Preservar relación AC/DC para cálculo de SpO2
    // Componente AC: variación pulsátil
    const recentValues = this.valueBuffer.slice(-10);
    const minValue = Math.min(...recentValues);
    const maxValue = Math.max(...recentValues);
    const acComponent = maxValue - minValue;
    
    // Componente DC: valor base
    const dcComponent = minValue;
    
    // Verificar que componente DC sea significativo
    if (dcComponent < 0.1) {
      return value; // Señal muy débil, no optimizar
    }
    
    // Ratio AC/DC (crucial para SpO2)
    const perfusionIndex = acComponent / dcComponent;
    
    // Normalizar valor preservando perfusión
    let optimizedValue = value;
    const targetPI = perfusionIndex * this.parameters.sensitivity;
    
    // Si el valor está cerca de un pico, intensificar para preservar PI
    const isNearPeak = (value > this.valueBuffer[this.valueBuffer.length - 1]);
    if (isNearPeak && perfusionIndex > 0) {
      optimizedValue = value * (1 + 0.1 * this.parameters.sensitivity);
    }
    
    return optimizedValue;
  }
  
  /**
   * Procesa retroalimentación del calculador
   */
  public override processFeedback(feedback: FeedbackData): void {
    if (feedback.channel !== 'spo2') return;
    
    // Escala de ajuste según magnitud
    const adjustmentScale = feedback.magnitude * 0.1;
    
    switch (feedback.adjustment) {
      case 'increase':
        // Incrementar sensibilidad para detectar variaciones AC
        this.parameters.sensitivity *= (1 + adjustmentScale);
        
        // Reducir filtrado para preservar componente AC
        this.parameters.filterStrength = Math.max(0.25, this.parameters.filterStrength * (1 - adjustmentScale * 0.5));
        break;
        
      case 'decrease':
        // Incrementar filtrado para estabilizar
        this.parameters.filterStrength = Math.min(0.75, this.parameters.filterStrength * (1 + adjustmentScale * 0.5));
        
        // Reducir sensibilidad
        this.parameters.sensitivity = Math.max(0.8, this.parameters.sensitivity * (1 - adjustmentScale * 0.5));
        break;
        
      case 'fine-tune':
        // Ajustar parámetro específico si se proporciona
        if (feedback.parameter) {
          const param = feedback.parameter as keyof typeof this.parameters;
          if (this.parameters[param] !== undefined) {
            const direction = feedback.confidence && feedback.confidence < 0.5 ? 1 : -1;
            const adjustFactor = direction * adjustmentScale * 0.1;
            this.parameters[param] = this.parameters[param] * (1 + adjustFactor);
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
