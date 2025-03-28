
/**
 * Optimizador base de canales
 * Esta clase proporciona funcionalidad base para todos los optimizadores de canales especializados
 */

import { ProcessedPPGSignal } from '../signal-processing/types';
import { OptimizedSignal, ChannelOptimizerConfig, FeedbackData } from './types';

export abstract class BaseChannelOptimizer {
  protected readonly channelId: string;
  protected config: ChannelOptimizerConfig;
  protected signalBuffer: ProcessedPPGSignal[] = [];
  protected readonly maxBufferSize: number = 100;
  
  constructor(channelId: string, config: ChannelOptimizerConfig = {}) {
    this.channelId = channelId;
    this.config = {
      amplificationFactor: 1.0,
      filteringLevel: 'medium',
      ...config
    };
  }
  
  /**
   * Optimiza una señal PPG para este canal específico
   */
  public abstract optimizeSignal(signal: ProcessedPPGSignal): OptimizedSignal | null;
  
  /**
   * Procesa retroalimentación desde el módulo de cálculo
   */
  public abstract processFeedback(feedback: FeedbackData): void;
  
  /**
   * Aplica transformaciones en el dominio de la frecuencia
   * Este método puede ser implementado por clases hijas pero no es obligatorio
   */
  protected applyFrequencyDomain?(values: number[]): number[];
  
  /**
   * Aplicar filtrado adaptativo
   */
  protected applyAdaptiveFiltering(values: number[]): number[] {
    // Implementación base de filtrado adaptativo
    if (values.length < 3) return values;
    
    const filteredValues: number[] = [];
    const alpha = this.getAlpha();
    
    // Filtro básico con factor alpha configurable
    filteredValues.push(values[0]);
    for (let i = 1; i < values.length; i++) {
      const filtered = alpha * values[i] + (1 - alpha) * filteredValues[i-1];
      filteredValues.push(filtered);
    }
    
    return filteredValues;
  }
  
  /**
   * Obtiene el factor alpha para filtrado adaptativo basado en configuración
   */
  protected getAlpha(): number {
    switch (this.config.filteringLevel) {
      case 'low': return 0.7;
      case 'medium': return 0.5;
      case 'high': return 0.3;
      default: return 0.5;
    }
  }
  
  /**
   * Añade una señal al buffer
   */
  protected addToBuffer(signal: ProcessedPPGSignal): void {
    this.signalBuffer.push(signal);
    if (this.signalBuffer.length > this.maxBufferSize) {
      this.signalBuffer.shift();
    }
  }
  
  /**
   * Reinicia el optimizador
   */
  public reset(): void {
    this.signalBuffer = [];
  }
  
  /**
   * Amplifica una señal según el factor configurado
   */
  protected amplifySignal(value: number): number {
    return value * (this.config.amplificationFactor || 1.0);
  }
  
  /**
   * Normaliza valores entre 0 y 1
   */
  protected normalizeValues(values: number[]): number[] {
    if (values.length === 0) return [];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    if (range === 0) return values.map(() => 0.5);
    
    return values.map(v => (v - min) / range);
  }
}
