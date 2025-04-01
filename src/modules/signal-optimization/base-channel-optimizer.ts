
/**
 * Optimizador base para todos los canales
 */

import { ChannelOptimizer, OptimizedSignal, FeedbackData } from './types';
import { ProcessedPPGSignal } from '../signal-processing/types';

/**
 * Parámetros configurables para el optimizador
 */
export interface OptimizerParameters {
  amplification: number;
  filterStrength: number;
  sensitivity: number;
  smoothing: number;
  noiseThreshold: number;
  dynamicRange: number;
}

/**
 * Clase base para optimizadores de canal
 * Proporciona funcionalidad común para todos los optimizadores
 */
export class BaseChannelOptimizer implements ChannelOptimizer {
  protected channel: string;
  protected parameters: OptimizerParameters;
  protected valueBuffer: number[] = [];
  protected _maxBufferSize: number = 60;
  protected noiseEstimate: number = 0.1;
  protected lastOptimizedValue: number = 0;
  protected defaultParameters: OptimizerParameters;
  
  constructor(channel: string, initialParameters: OptimizerParameters) {
    this.channel = channel;
    this.parameters = { ...initialParameters };
    this.defaultParameters = { ...initialParameters };
  }
  
  /**
   * Optimiza una señal procesada para este canal específico
   */
  public optimize(signal: ProcessedPPGSignal): OptimizedSignal {
    // Amplificar señal
    const amplified = this.applyAdaptiveAmplification(signal.filteredValue);
    
    // Filtrar señal
    const filtered = this.applyAdaptiveFiltering(amplified);
    
    // Actualizar buffer
    this.valueBuffer.push(filtered);
    if (this.valueBuffer.length > this._maxBufferSize) {
      this.valueBuffer.shift();
    }
    
    // Actualizar estimación de ruido
    this.updateNoiseEstimate();
    
    // Calcular confianza
    const confidence = this.calculateConfidence(signal);
    
    // Guardar valor optimizado para siguiente iteración
    this.lastOptimizedValue = filtered;
    
    return {
      channel: this.channel as any,
      timestamp: signal.timestamp,
      value: filtered,
      rawValue: signal.rawValue,
      amplified: amplified,
      filtered: filtered,
      confidence: confidence,
      quality: signal.quality
    };
  }
  
  /**
   * Aplica amplificación adaptativa a la señal
   */
  protected applyAdaptiveAmplification(value: number): number {
    return value * this.parameters.amplification;
  }
  
  /**
   * Aplica filtrado adaptativo a la señal
   */
  protected applyAdaptiveFiltering(value: number): number {
    // Si no hay suficientes valores en el buffer, devolver valor sin cambios
    if (this.valueBuffer.length < 3) {
      return value;
    }
    
    // Filtrado exponencial
    const alpha = 1 - this.parameters.filterStrength;
    const previousValue = this.valueBuffer[this.valueBuffer.length - 1];
    const filtered = value * alpha + previousValue * (1 - alpha);
    
    return filtered;
  }
  
  /**
   * Actualiza la estimación de ruido basada en valores recientes
   */
  protected updateNoiseEstimate(): void {
    if (this.valueBuffer.length < 10) return;
    
    // Tomar última ventana de valores
    const window = this.valueBuffer.slice(-10);
    
    // Calcular la media móvil
    const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
    
    // Calcular desviación absoluta media
    const mad = window.reduce((sum, val) => sum + Math.abs(val - mean), 0) / window.length;
    
    // Actualizar estimación de ruido con suavizado
    this.noiseEstimate = this.noiseEstimate * 0.9 + mad * 0.1;
  }
  
  /**
   * Calcula nivel de confianza para la señal optimizada
   */
  protected calculateConfidence(signal: ProcessedPPGSignal): number {
    // Factores que determinan la confianza:
    // 1. Calidad de la señal original
    // 2. Nivel de ruido estimado
    // 3. Estabilidad de la señal (ventana reciente)
    
    // Factor de calidad
    const qualityFactor = signal.quality / 100;
    
    // Factor de ruido (menor ruido = mayor confianza)
    const noiseFactor = Math.max(0, 1 - this.noiseEstimate * 10);
    
    // Factor de estabilidad (si hay suficientes muestras)
    let stabilityFactor = 0.5;
    if (this.valueBuffer.length > 10) {
      const recentValues = this.valueBuffer.slice(-10);
      const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
      const cv = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 1;
      stabilityFactor = Math.max(0, Math.min(1, 1 - cv));
    }
    
    // Calcular confianza combinada
    const confidence = (
      qualityFactor * 0.4 + 
      noiseFactor * 0.3 + 
      stabilityFactor * 0.3
    );
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  /**
   * Procesa retroalimentación del calculador
   */
  public processFeedback(feedback: FeedbackData): void {
    // Implementación base - debe ser sobreescrita por clases hijas
    console.log(`Feedback recibido en ${this.channel}:`, feedback);
  }
  
  /**
   * Reinicia el optimizador a valores por defecto
   */
  public reset(): void {
    this.valueBuffer = [];
    this.parameters = { ...this.defaultParameters };
    this.noiseEstimate = 0.1;
    this.lastOptimizedValue = 0;
  }
}
