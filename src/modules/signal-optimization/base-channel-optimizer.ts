
/**
 * Optimizador base para todos los canales
 * Implementa funcionalidad común para los optimizadores especializados
 */

import { ProcessedPPGSignal } from '../signal-processing/types';
import { ChannelOptimizer, OptimizationParameters, OptimizedSignal, FeedbackData, VitalSignChannel } from './types';

/**
 * Parámetros por defecto para optimización de canal
 */
const DEFAULT_PARAMS: OptimizationParameters = {
  amplificationFactor: 1.5,
  filterStrength: 0.6,
  noiseThreshold: 0.2,
  frequencyRange: [0.5, 4.0], // Hz
  sensitivityFactor: 1.0,
  adaptiveThreshold: true
};

export abstract class BaseChannelOptimizer implements ChannelOptimizer {
  // Canal de optimización
  protected readonly channel: VitalSignChannel;
  
  // Parámetros configurables
  protected parameters: OptimizationParameters;
  
  // Buffer de valores para análisis
  protected valueBuffer: number[] = [];
  protected readonly MAX_BUFFER_SIZE = 100;
  
  // Valor optimizado anterior para cálculos diferenciales
  protected lastOptimizedValue: number = 0;
  
  /**
   * Constructor para optimizador base
   */
  constructor(channel: VitalSignChannel, initialParams: Partial<OptimizationParameters> = {}) {
    this.channel = channel;
    this.parameters = { ...DEFAULT_PARAMS };
    this.setParameters(initialParams);
  }
  
  /**
   * Obtiene el canal gestionado por este optimizador
   */
  public getChannel(): VitalSignChannel {
    return this.channel;
  }
  
  /**
   * Obtiene los parámetros actuales de optimización
   */
  public getParameters(): OptimizationParameters {
    return { ...this.parameters };
  }
  
  /**
   * Actualiza parámetros de optimización
   */
  public setParameters(params: Partial<OptimizationParameters>): void {
    this.parameters = {
      ...this.parameters,
      ...params
    };
  }
  
  /**
   * Método principal de optimización de señal
   */
  public optimize(signal: ProcessedPPGSignal): OptimizedSignal {
    // Actualizar buffer para análisis
    this.valueBuffer.push(signal.filteredValue);
    if (this.valueBuffer.length > this.MAX_BUFFER_SIZE) {
      this.valueBuffer.shift();
    }
    
    // Aplicar optimizaciones específicas de canal
    const optimizedValue = this.applyChannelSpecificOptimizations(signal);
    
    // Calcular calidad de señal optimizada
    const quality = this.calculateSignalQuality(optimizedValue);
    
    // Crear resultado
    const result: OptimizedSignal = {
      channel: this.channel,
      timestamp: signal.timestamp,
      value: signal.filteredValue,
      quality,
      optimizedValue,
      parameters: this.getParameters(),
      metadata: {
        rrIntervals: signal.rrIntervals || [],
        lastPeakTime: signal.lastPeakTime || null,
        isPeak: signal.isPeak || false
      }
    };
    
    // Actualizar valor optimizado anterior
    this.lastOptimizedValue = optimizedValue;
    
    return result;
  }
  
  /**
   * Procesa feedback desde el calculador
   */
  public processFeedback(feedback: FeedbackData): void {
    // Verificar que el feedback sea para este canal
    if (feedback.channel !== this.channel) return;
    
    // Aplicar sugerencias de ajuste de parámetros si existen
    if (feedback.suggestedAdjustments) {
      // Aplicar ajustes manteniendo límites razonables
      this.setParameters(feedback.suggestedAdjustments);
    }
    
    // Permitir adaptaciones específicas en subclases
    this.adaptToFeedback(feedback);
  }
  
  /**
   * Reinicia el optimizador
   */
  public reset(): void {
    this.valueBuffer = [];
    this.lastOptimizedValue = 0;
    this.resetChannelParameters();
  }
  
  /**
   * Aplicar filtro adaptativo
   */
  protected applyAdaptiveFilter(value: number): number {
    if (this.valueBuffer.length < 3) return value;
    
    // Obtener intensidad de filtrado del canal
    const filterStrength = this.parameters.filterStrength;
    
    // Media móvil ponderada
    const weight1 = filterStrength;
    const weight2 = (1 - filterStrength) * 0.7;
    const weight3 = (1 - filterStrength) * 0.3;
    
    const filteredValue = 
      value * weight1 + 
      this.valueBuffer[this.valueBuffer.length - 1] * weight2 + 
      this.valueBuffer[this.valueBuffer.length - 2] * weight3;
    
    // Normalizar resultado
    return filteredValue / (weight1 + weight2 + weight3);
  }
  
  /**
   * Amplifica señal según parámetros del canal
   */
  protected amplifySignal(value: number): number {
    // Amplificar alrededor de 0.5 (punto medio)
    const normalized = value - 0.5;
    const amplified = normalized * this.parameters.amplificationFactor;
    
    // Devolver a rango [0,1] con límites suaves
    return Math.max(0, Math.min(1, amplified + 0.5));
  }
  
  /**
   * Aplica procesamiento en dominio de frecuencia
   */
  protected applyFrequencyDomain(value: number, timestamp: number): number {
    // Implementación simplificada para filtros de frecuencia
    // En una implementación real se usaría FFT u otros filtros espectrales
    
    return value;
  }
  
  /**
   * Calcula calidad de señal optimizada
   */
  protected calculateSignalQuality(optimizedValue: number): number {
    if (this.valueBuffer.length < 10) return 50; // Calidad media inicial
    
    // Calcular métricas de calidad básicas (estabilidad, amplitud, etc.)
    const recentValues = this.valueBuffer.slice(-10);
    
    // Variabilidad (menor = más estable)
    let variability = 0;
    for (let i = 1; i < recentValues.length; i++) {
      variability += Math.abs(recentValues[i] - recentValues[i-1]);
    }
    variability /= recentValues.length - 1;
    
    // Amplitud (mayor = mejor señal)
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Calcular calidad relativa a parámetros esperados para el canal
    const stabilityFactor = Math.max(0, 1 - variability * 10);
    const amplitudeFactor = Math.min(1, amplitude * 5);
    
    // Combinar factores con pesos específicos
    const quality = (stabilityFactor * 0.6 + amplitudeFactor * 0.4) * 100;
    
    return Math.max(0, Math.min(100, quality));
  }
  
  /**
   * Método abstracto para optimizaciones específicas por canal
   * Debe ser implementado por subclases
   */
  protected abstract applyChannelSpecificOptimizations(signal: ProcessedPPGSignal): number;
  
  /**
   * Permite adaptaciones específicas basadas en feedback
   * Puede ser sobrecargado por subclases
   */
  protected adaptToFeedback(feedback: FeedbackData): void {
    // Implementación base vacía
  }
  
  /**
   * Reinicia parámetros específicos del canal
   * Puede ser sobrecargado por subclases
   */
  protected resetChannelParameters(): void {
    // Reimplementación por defecto
  }
}
