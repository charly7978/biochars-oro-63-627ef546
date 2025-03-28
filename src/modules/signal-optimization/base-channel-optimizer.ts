
/**
 * Implementación base para optimizadores de canal
 * Proporciona funcionalidad común a todos los canales
 */

import { ProcessedPPGSignal } from '../signal-processing/types';
import { 
  ChannelOptimizer, 
  OptimizationParameters, 
  OptimizedSignal, 
  VitalSignChannel,
  FeedbackData
} from './types';

/**
 * Parámetros de optimización por defecto
 */
export const DEFAULT_OPTIMIZATION_PARAMETERS: OptimizationParameters = {
  amplificationFactor: 1.5,
  filterStrength: 0.65,
  noiseThreshold: 0.2,
  frequencyRange: [0.5, 4.0], // 0.5Hz - 4.0Hz (30-240 BPM)
  sensitivityFactor: 1.0,
  adaptiveThreshold: true
};

/**
 * Clase base para los optimizadores de canal
 * Implementa funcionalidad común y permite personalización en subclases
 */
export abstract class BaseChannelOptimizer implements ChannelOptimizer {
  protected parameters: OptimizationParameters;
  protected valueBuffer: number[] = [];
  protected readonly MAX_BUFFER_SIZE = 30;
  protected lastOptimizedValue: number = 0;
  protected lastQuality: number = 0;
  
  constructor(protected readonly channel: VitalSignChannel, initialParams?: Partial<OptimizationParameters>) {
    this.parameters = {
      ...DEFAULT_OPTIMIZATION_PARAMETERS,
      ...initialParams
    };
  }

  public getChannel(): VitalSignChannel {
    return this.channel;
  }

  public getParameters(): OptimizationParameters {
    return { ...this.parameters };
  }

  public setParameters(params: Partial<OptimizationParameters>): void {
    this.parameters = {
      ...this.parameters,
      ...params
    };
  }

  /**
   * Optimiza la señal para este canal específico
   * Implementación por defecto que puede ser sobrescrita
   */
  public optimize(signal: ProcessedPPGSignal): OptimizedSignal {
    // Almacenar valor en buffer
    this.valueBuffer.push(signal.filteredValue);
    if (this.valueBuffer.length > this.MAX_BUFFER_SIZE) {
      this.valueBuffer.shift();
    }
    
    // Aplicar optimizaciones específicas del canal
    const optimizedValue = this.applyChannelSpecificOptimizations(signal);
    
    // Calcular calidad específica del canal
    const quality = this.calculateChannelQuality(signal, optimizedValue);
    
    // Guardar último valor y calidad
    this.lastOptimizedValue = optimizedValue;
    this.lastQuality = quality;
    
    return {
      channel: this.channel,
      timestamp: signal.timestamp,
      value: signal.filteredValue,
      optimizedValue,
      quality,
      parameters: { ...this.parameters }
    };
  }

  /**
   * Procesa retroalimentación del módulo de cálculo
   * Implementación por defecto que puede ser sobrescrita
   */
  public processFeedback(feedback: FeedbackData): void {
    if (feedback.suggestedAdjustments) {
      // Aplicar ajustes sugeridos
      this.setParameters(feedback.suggestedAdjustments);
    }
    
    // Implementar lógica específica de adaptación basada en confianza
    this.adaptToFeedback(feedback);
  }

  /**
   * Aplica optimizaciones específicas para el canal
   * Debe ser implementado por cada subclase
   */
  protected abstract applyChannelSpecificOptimizations(signal: ProcessedPPGSignal): number;
  
  /**
   * Calcula la calidad específica para el canal
   * Puede ser sobrescrito por subclases
   */
  protected calculateChannelQuality(signal: ProcessedPPGSignal, optimizedValue: number): number {
    // Implementación básica que combina calidad original con estabilidad específica del canal
    const baseQuality = signal.quality;
    const stabilityFactor = this.calculateStabilityFactor();
    
    // Combinar calidades con peso personalizado
    return Math.round((baseQuality * 0.7) + (stabilityFactor * 30));
  }
  
  /**
   * Calcula un factor de estabilidad (0-1) basado en la consistencia de la señal optimizada
   */
  protected calculateStabilityFactor(): number {
    if (this.valueBuffer.length < 5) return 0.5;
    
    // Calcular variación en la señal reciente
    const recent = this.valueBuffer.slice(-5);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    
    // Calcular desviación estándar normalizada
    let variance = 0;
    for (const val of recent) {
      variance += Math.pow(val - mean, 2);
    }
    variance /= recent.length;
    
    const stdDev = Math.sqrt(variance);
    const normalizedStdDev = stdDev / (Math.abs(mean) + 0.01); // Evitar división por cero
    
    // Convertir a factor de estabilidad (menor variación = mayor estabilidad)
    return Math.max(0, Math.min(1, 1 - (normalizedStdDev * 5)));
  }
  
  /**
   * Adapta el optimizador basado en retroalimentación
   * Puede ser sobrescrito por subclases
   */
  protected adaptToFeedback(feedback: FeedbackData): void {
    // Implementación base: adaptar sensibilidad basado en confianza
    if (feedback.confidence < 0.4) {
      // Baja confianza: aumentar amplificación y sensibilidad
      this.parameters.amplificationFactor = Math.min(2.5, this.parameters.amplificationFactor * 1.05);
      this.parameters.sensitivityFactor = Math.min(1.5, this.parameters.sensitivityFactor * 1.05);
    } else if (feedback.confidence > 0.8) {
      // Alta confianza: reducir ligeramente para estabilidad
      this.parameters.amplificationFactor = Math.max(1.0, this.parameters.amplificationFactor * 0.98);
      this.parameters.sensitivityFactor = Math.max(0.8, this.parameters.sensitivityFactor * 0.98);
    }
  }
  
  /**
   * Aplica un filtro adaptativo a la señal
   */
  protected applyAdaptiveFilter(value: number): number {
    if (this.valueBuffer.length < 3) return value;
    
    const alpha = this.parameters.filterStrength;
    const lastValue = this.valueBuffer[this.valueBuffer.length - 1];
    
    return alpha * value + (1 - alpha) * lastValue;
  }
  
  /**
   * Amplifica la señal según los parámetros del canal
   */
  protected amplifySignal(value: number): number {
    // Normalizar alrededor de 0.5
    const normalized = value - 0.5;
    
    // Amplificar según factor configurado
    const amplified = normalized * this.parameters.amplificationFactor;
    
    // Devolver a rango [0,1]
    return Math.max(0, Math.min(1, amplified + 0.5));
  }
  
  /**
   * Reinicia el optimizador
   */
  public reset(): void {
    this.valueBuffer = [];
    this.lastOptimizedValue = 0;
    this.lastQuality = 0;
    
    // Restablecer parámetros a valores por defecto específicos del canal
    this.resetChannelParameters();
  }
  
  /**
   * Restablece parámetros específicos del canal
   * Puede ser sobrescrito por subclases
   */
  protected resetChannelParameters(): void {
    // Por defecto, volver a parámetros iniciales
    this.parameters = { ...DEFAULT_OPTIMIZATION_PARAMETERS };
  }
}
