
/**
 * Optimizador de señal para presión arterial
 */

import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { OptimizedSignal, FeedbackData } from '../types';
import { ProcessedPPGSignal } from '../../signal-processing/types';

/**
 * Optimizador especializado para señales de presión arterial
 */
export class BloodPressureOptimizer extends BaseChannelOptimizer {
  constructor() {
    super('bloodPressure', {
      amplification: 1.1,
      filterStrength: 0.6,
      sensitivity: 1.2,
      smoothing: 0.3,
      noiseThreshold: 0.1,
      dynamicRange: 1.0
    });
    
    // Buffer específico para presión arterial
    this._maxBufferSize = 90;
  }
  
  /**
   * Optimiza la señal para cálculo de presión arterial
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
    
    // Aplicar procesamiento específico para presión arterial
    const optimized = this.applyBPSpecificProcessing(filtered);
    
    // Actualizar estimación de ruido
    this.updateNoiseEstimate();
    
    // Calcular confianza
    const confidence = this.calculateConfidence(signal);
    
    // Guardar valor optimizado para siguiente iteración
    this.lastOptimizedValue = optimized;
    
    // Limitar valor a rango [0,1]
    const normalizedValue = Math.max(0, Math.min(1, optimized));
    
    return {
      channel: 'bloodPressure',
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
   * Aplica procesamiento específico para presión arterial
   */
  private applyBPSpecificProcessing(value: number): number {
    if (this.valueBuffer.length < 10) {
      return value;
    }
    
    // Preservar componentes de alta frecuencia para detectar dicrótico
    // Mezcla de valor actual con filtrado ligero
    const highFreqEmphasis = 0.7;
    const preservedValue = value * highFreqEmphasis + 
                          this.valueBuffer[this.valueBuffer.length - 1] * (1 - highFreqEmphasis);
    
    // Aplicar filtrado de mediana para eliminar espículas
    if (this.valueBuffer.length >= 5) {
      const medianWindow = [...this.valueBuffer.slice(-4), preservedValue];
      medianWindow.sort((a, b) => a - b);
      const medianValue = medianWindow[2]; // Valor central
      
      // Mezclar valor preservado y mediana
      const blendFactor = 0.4;
      return preservedValue * (1 - blendFactor) + medianValue * blendFactor;
    }
    
    return preservedValue;
  }
  
  /**
   * Procesa retroalimentación del calculador
   */
  public override processFeedback(feedback: FeedbackData): void {
    if (feedback.channel !== 'bloodPressure') return;
    
    // Escala de ajuste según magnitud
    const adjustmentScale = feedback.magnitude * 0.15;
    
    switch (feedback.adjustment) {
      case 'increase':
        // Preservar más detalles para detectar dicrótico
        this.parameters.filterStrength = Math.max(0.3, this.parameters.filterStrength * (1 - adjustmentScale));
        
        // Incrementar sensibilidad
        this.parameters.sensitivity *= (1 + adjustmentScale);
        break;
        
      case 'decrease':
        // Suavizar más para reducir ruido
        this.parameters.filterStrength = Math.min(0.8, this.parameters.filterStrength * (1 + adjustmentScale * 0.5));
        
        // Reducir amplificación
        this.parameters.amplification *= (1 - adjustmentScale * 0.5);
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
