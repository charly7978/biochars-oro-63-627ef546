
/**
 * Optimizador base de canal
 * 
 * Clase base abstracta para todos los optimizadores de canal
 */

import { OptimizedSignal, OptimizationParameters, VitalSignChannel, FeedbackData } from './types';
import { ProcessedPPGSignal } from '../signal-processing/types';

/**
 * Clase base para optimizadores de canal
 */
export abstract class BaseChannelOptimizer {
  protected channelName: VitalSignChannel;
  protected parameters: OptimizationParameters;
  protected lastOptimizedValue: number = 0;
  protected valueBuffer: number[] = [];
  protected _maxBufferSize: number = 60;
  protected confidenceLevel: number = 0;
  protected noiseEstimate: number = 0;
  
  constructor(channelName: VitalSignChannel, customParams?: Partial<OptimizationParameters>) {
    this.channelName = channelName;
    
    // Parámetros por defecto
    this.parameters = {
      amplification: 1.0,
      filterStrength: 0.5,
      sensitivity: 1.0,
      smoothing: 0.3,
      noiseThreshold: 0.1,
      dynamicRange: 1.0
    };
    
    // Aplicar personalización
    if (customParams) {
      this.parameters = {
        ...this.parameters,
        ...customParams
      };
    }
  }
  
  /**
   * Optimiza una señal PPG para el canal específico
   */
  public abstract optimize(signal: ProcessedPPGSignal): OptimizedSignal;
  
  /**
   * Procesa retroalimentación del calculador
   */
  public abstract processFeedback(feedback: FeedbackData): void;
  
  /**
   * Aplica amplificación adaptativa basada en relación señal/ruido
   */
  protected applyAdaptiveAmplification(value: number): number {
    // Calcular factor de amplificación dinámico
    const amplificationFactor = this.parameters.amplification * 
      (1 + 0.5 * Math.max(0, 1 - this.noiseEstimate));
    
    // Aplicar amplificación
    return value * amplificationFactor;
  }
  
  /**
   * Aplica filtrado adaptativo basado en características de la señal
   */
  protected applyAdaptiveFiltering(value: number): number {
    // Añadir al buffer
    this.addToBuffer(value);
    
    // Si el buffer es insuficiente, devolver valor original
    if (this.valueBuffer.length < 3) {
      return value;
    }
    
    // Calcular intensidad de filtro dinámica
    const filterFactor = this.parameters.filterStrength * 
      (1 + 0.3 * Math.min(1, this.noiseEstimate / 0.2));
    
    // Aplicar filtro de media móvil ponderada
    const weights = [0.2, 0.3, 0.5]; // Mayor peso a muestras recientes
    let filteredValue = 0;
    let weightSum = 0;
    
    // Tomar las últimas 3 muestras
    const samples = this.valueBuffer.slice(-3);
    
    for (let i = 0; i < samples.length; i++) {
      filteredValue += samples[i] * weights[i];
      weightSum += weights[i];
    }
    
    // Normalizar por suma de pesos
    filteredValue /= weightSum;
    
    // Mezclar valor original y filtrado según intensidad
    return value * (1 - filterFactor) + filteredValue * filterFactor;
  }
  
  /**
   * Actualiza estimación de ruido
   */
  protected updateNoiseEstimate(): void {
    if (this.valueBuffer.length < 10) {
      this.noiseEstimate = 0.3; // Valor por defecto con pocas muestras
      return;
    }
    
    // Usar últimas 10 muestras
    const samples = this.valueBuffer.slice(-10);
    
    // Calcular diferencias consecutivas
    const diffs = [];
    for (let i = 1; i < samples.length; i++) {
      diffs.push(Math.abs(samples[i] - samples[i-1]));
    }
    
    // Ordenar diferencias
    diffs.sort((a, b) => a - b);
    
    // Usar mediana de diferencias como estimador de ruido
    const medianIndex = Math.floor(diffs.length / 2);
    const medianDiff = diffs[medianIndex];
    
    // Normalizar a [0,1]
    this.noiseEstimate = Math.min(1, medianDiff / 0.3);
  }
  
  /**
   * Añade un valor al buffer
   */
  protected addToBuffer(value: number): void {
    this.valueBuffer.push(value);
    
    // Limitar tamaño de buffer
    if (this.valueBuffer.length > this._maxBufferSize) {
      this.valueBuffer.shift();
    }
  }
  
  /**
   * Calcula confianza basada en calidad de señal
   */
  protected calculateConfidence(signal: ProcessedPPGSignal): number {
    // Factores de confianza
    
    // 1. Calidad de señal (de procesador)
    const signalQualityFactor = signal.quality / 100;
    
    // 2. Detección de dedo
    const fingerDetectionFactor = signal.fingerDetected ? 1.0 : 0.0;
    
    // 3. Fuerza de señal
    const signalStrengthFactor = signal.signalStrength / 100;
    
    // 4. Estabilidad de señal
    const stabilityFactor = this.calculateStabilityFactor();
    
    // Combinación ponderada
    return (signalQualityFactor * 0.3) + 
           (fingerDetectionFactor * 0.4) + 
           (signalStrengthFactor * 0.2) + 
           (stabilityFactor * 0.1);
  }
  
  /**
   * Calcula factor de estabilidad
   */
  protected calculateStabilityFactor(): number {
    if (this.valueBuffer.length < 10) {
      return 0.5; // Valor por defecto con pocas muestras
    }
    
    // Usar últimas 10 muestras
    const samples = this.valueBuffer.slice(-10);
    
    // Calcular desviación estándar
    const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
    const variance = samples.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalizar a [0,1] donde 1 es más estable
    // Asumir que desviación de 0.3 o más es inestable
    return Math.max(0, 1 - (stdDev / 0.3));
  }
  
  /**
   * Resetea el optimizador
   */
  public reset(): void {
    this.valueBuffer = [];
    this.lastOptimizedValue = 0;
    this.confidenceLevel = 0;
    this.noiseEstimate = 0;
    
    // Restaurar parámetros por defecto
    this.parameters = {
      amplification: 1.0,
      filterStrength: 0.5,
      sensitivity: 1.0,
      smoothing: 0.3,
      noiseThreshold: 0.1,
      dynamicRange: 1.0
    };
  }
}
