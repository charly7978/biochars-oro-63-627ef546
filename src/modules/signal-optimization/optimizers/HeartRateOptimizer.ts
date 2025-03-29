
/**
 * Optimizador específico para el canal de ritmo cardíaco
 */

import { ChannelOptimizer, OptimizedSignal, FeedbackData, VitalSignChannel } from '../types';
import { ProcessedPPGSignal } from '../../signal-processing/types';
import { applyMovingAverageFilter, amplifySignal } from '../../signal-processing/utils/signal-normalizer';

export class HeartRateOptimizer implements ChannelOptimizer {
  private valueBuffer: number[] = [];
  private readonly maxBufferSize = 30;
  private amplificationFactor = 1.0;
  private filterWindowSize = 3;
  private readonly channel: VitalSignChannel = 'heartRate';
  
  /**
   * Optimiza la señal para cálculo de ritmo cardíaco
   */
  public optimize(signal: ProcessedPPGSignal): OptimizedSignal {
    // Añadir valor al buffer
    this.valueBuffer.push(signal.filteredValue);
    if (this.valueBuffer.length > this.maxBufferSize) {
      this.valueBuffer.shift();
    }
    
    // Aplicar filtrado específico para ritmo cardíaco
    const filtered = this.applyHeartRateFilter(signal.filteredValue);
    
    // Aplicar amplificación adaptativa
    const amplified = this.amplifyHeartSignal(filtered);
    
    // Calcular nivel de confianza/calidad
    const confidence = this.calculateConfidence(signal);
    
    // Crear señal optimizada
    return {
      channel: this.channel,
      timestamp: signal.timestamp,
      value: amplified,
      rawValue: signal.rawValue,
      amplified,
      filtered,
      confidence,
      quality: Math.round(confidence * 100)
    };
  }
  
  /**
   * Procesa retroalimentación del calculador
   */
  public processFeedback(feedback: FeedbackData): void {
    if (!feedback.parameter) return;
    
    switch (feedback.parameter) {
      case 'amplification':
        // Ajustar factor de amplificación
        if (feedback.adjustment === 'increase') {
          this.amplificationFactor = Math.min(3.0, this.amplificationFactor + (feedback.magnitude || 0.1));
        } else if (feedback.adjustment === 'decrease') {
          this.amplificationFactor = Math.max(0.5, this.amplificationFactor - (feedback.magnitude || 0.1));
        } else if (feedback.adjustment === 'reset') {
          this.amplificationFactor = 1.0;
        }
        break;
      
      case 'filtering':
        // Ajustar ventana de filtrado
        if (feedback.adjustment === 'increase') {
          this.filterWindowSize = Math.min(7, this.filterWindowSize + 1);
        } else if (feedback.adjustment === 'decrease') {
          this.filterWindowSize = Math.max(1, this.filterWindowSize - 1);
        } else if (feedback.adjustment === 'reset') {
          this.filterWindowSize = 3;
        }
        break;
    }
    
    console.log(`HeartRateOptimizer: Ajuste aplicado a ${feedback.parameter}`, {
      adjustment: feedback.adjustment,
      magnitude: feedback.magnitude,
      newAmplification: this.amplificationFactor,
      newFilterSize: this.filterWindowSize
    });
  }
  
  /**
   * Reinicia el optimizador
   */
  public reset(): void {
    this.valueBuffer = [];
    this.amplificationFactor = 1.0;
    this.filterWindowSize = 3;
  }
  
  /**
   * Aplica filtrado específico para ritmo cardíaco
   */
  private applyHeartRateFilter(value: number): number {
    if (this.valueBuffer.length < 3) return value;
    
    // Aplicar filtro de media móvil con tamaño adaptativo
    return applyMovingAverageFilter(value, this.valueBuffer.slice(0, -1), this.filterWindowSize);
  }
  
  /**
   * Amplifica señal específicamente para detección de latidos
   */
  private amplifyHeartSignal(value: number): number {
    if (this.valueBuffer.length < 3) return value;
    
    // Amplificación adaptativa según el factor configurado
    return amplifySignal(value, this.valueBuffer.slice(0, -1), this.amplificationFactor);
  }
  
  /**
   * Calcula nivel de confianza para la señal de ritmo cardíaco
   */
  private calculateConfidence(signal: ProcessedPPGSignal): number {
    if (!signal.fingerDetected) return 0;
    
    // Partir de calidad base de la señal
    let confidence = signal.quality / 100;
    
    // Mejorar confianza si hay intervalos RR consistentes
    if (signal.rrIntervals && signal.rrIntervals.length >= 3) {
      confidence += 0.1;
    }
    
    // Ajustar según amplitud de la señal en el buffer
    if (this.valueBuffer.length >= 5) {
      const recentValues = this.valueBuffer.slice(-5);
      const min = Math.min(...recentValues);
      const max = Math.max(...recentValues);
      const range = max - min;
      
      // Mejorar confianza si hay buena amplitud
      if (range > 0.1 && range < 0.5) {
        confidence += 0.1;
      } else if (range < 0.05) {
        confidence -= 0.2;
      }
    }
    
    // Limitar al rango [0, 1]
    return Math.max(0, Math.min(1, confidence));
  }
}
