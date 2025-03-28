
/**
 * Optimizador base de canales
 * Esta clase proporciona funcionalidad base para todos los optimizadores de canales especializados
 */

import { ProcessedPPGSignal } from '../signal-processing/types';
import { 
  OptimizedSignal, 
  ChannelOptimizerConfig, 
  FeedbackData, 
  ChannelOptimizer, 
  VitalSignChannel,
  OptimizationParameters, 
  FilteringLevel 
} from './types';

export abstract class BaseChannelOptimizer implements ChannelOptimizer {
  protected readonly channelId: VitalSignChannel;
  protected parameters: OptimizationParameters;
  protected signalBuffer: ProcessedPPGSignal[] = [];
  protected readonly maxBufferSize: number = 100;
  
  constructor(channelId: VitalSignChannel, config: Partial<OptimizationParameters> = {}) {
    this.channelId = channelId;
    this.parameters = {
      amplificationFactor: config.amplificationFactor || 1.0,
      filteringLevel: config.filteringLevel || 'medium',
      channelSpecific: config.channelSpecific || {}
    };
  }
  
  /**
   * Devuelve el canal asociado a este optimizador
   */
  public getChannel(): VitalSignChannel {
    return this.channelId;
  }
  
  /**
   * Obtiene los parámetros actuales
   */
  public getParameters(): OptimizationParameters {
    return { ...this.parameters };
  }
  
  /**
   * Establece parámetros
   */
  public setParameters(params: Partial<OptimizationParameters>): void {
    this.parameters = {
      ...this.parameters,
      ...params,
      channelSpecific: {
        ...this.parameters.channelSpecific,
        ...params.channelSpecific
      }
    };
  }
  
  /**
   * Optimiza una señal PPG para este canal específico
   * Implementación abstracta que debe ser proporcionada por clases derivadas
   */
  public abstract optimize(signal: ProcessedPPGSignal): OptimizedSignal;
  
  /**
   * Procesa retroalimentación desde el módulo de cálculo
   * Implementación abstracta que debe ser proporcionada por clases derivadas
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
    switch (this.parameters.filteringLevel) {
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
    return value * (this.parameters.amplificationFactor || 1.0);
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
  
  /**
   * Adapta parámetros según retroalimentación
   */
  protected adaptToFeedback(feedback: FeedbackData): void {
    if (feedback.parameter === 'amplificationFactor') {
      if (feedback.adjustment === 'increase') {
        this.parameters.amplificationFactor = Math.min(
          5.0, 
          this.parameters.amplificationFactor * (1 + feedback.magnitude)
        );
      } else if (feedback.adjustment === 'decrease') {
        this.parameters.amplificationFactor = Math.max(
          0.2, 
          this.parameters.amplificationFactor * (1 - feedback.magnitude)
        );
      } else if (feedback.adjustment === 'reset') {
        this.parameters.amplificationFactor = 1.0;
      }
    } else if (feedback.parameter === 'filteringLevel') {
      if (feedback.magnitude > 0.7) {
        this.parameters.filteringLevel = 'high';
      } else if (feedback.magnitude > 0.3) {
        this.parameters.filteringLevel = 'medium';
      } else {
        this.parameters.filteringLevel = 'low';
      }
    }
  }
  
  /**
   * Reinicia los parámetros a valores por defecto
   */
  protected resetChannelParameters(): void {
    this.parameters = {
      amplificationFactor: 1.0,
      filteringLevel: 'medium',
      channelSpecific: {}
    };
  }
}
