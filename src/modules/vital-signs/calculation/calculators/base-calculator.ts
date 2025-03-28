/**
 * Calculador base para signos vitales
 * 
 * Proporciona funcionalidad común para todos los calculadores específicos
 */

import { VitalSignCalculator, VitalSignCalculation } from '../types';
import { OptimizedSignal, VitalSignChannel, FeedbackData } from '../../../signal-optimization/types';

export abstract class BaseCalculator implements VitalSignCalculator {
  protected readonly channel: VitalSignChannel;
  protected lastCalculation: VitalSignCalculation | null = null;
  protected valueBuffer: number[] = [];
  protected _maxBufferSize: number = 60;
  protected confidenceThreshold = 0.4;
  protected suggestedParameters: Record<string, number> = {};
  
  constructor(channel: VitalSignChannel, maxBufferSize: number = 60) {
    this.channel = channel;
    this._maxBufferSize = maxBufferSize;
  }
  
  /**
   * Obtiene el canal asociado al calculador
   */
  public getChannel(): VitalSignChannel {
    return this.channel;
  }
  
  /**
   * Calcula el valor del signo vital a partir de la señal optimizada
   */
  public calculate(signal: OptimizedSignal): VitalSignCalculation {
    // Validación básica
    if (signal.channel !== this.channel) {
      throw new Error(`Canal incorrecto: esperado ${this.channel}, recibido ${signal.channel}`);
    }
    
    // Añadir valor al buffer
    this.valueBuffer.push(signal.optimizedValue);
    this.maintainBufferSize();
    
    // Realizar cálculo específico
    const result = this.performCalculation(signal);
    
    // Guardar último cálculo
    this.lastCalculation = result;
    
    return result;
  }
  
  /**
   * Implementación específica de cálculo (a implementar por subclases)
   */
  protected abstract performCalculation(signal: OptimizedSignal): VitalSignCalculation;
  
  /**
   * Genera feedback para el optimizador si es necesario
   */
  public generateFeedback(): FeedbackData | null {
    if (!this.lastCalculation || Object.keys(this.suggestedParameters).length === 0) {
      return null;
    }
    
    // Solo generar feedback si la confianza está por debajo del umbral
    if (this.lastCalculation.confidence >= this.confidenceThreshold) {
      return null;
    }
    
    // Generar feedback con parámetros sugeridos
    return {
      channel: this.channel,
      confidence: this.lastCalculation.confidence,
      suggestedAdjustments: this.convertSuggestedParameters(),
      timestamp: Date.now()
    };
  }
  
  /**
   * Convierte parámetros sugeridos al formato esperado por el optimizador
   */
  private convertSuggestedParameters(): any {
    const result: any = {};
    
    // Mapear parámetros internos a formato del optimizador
    if (this.suggestedParameters.amplification !== undefined) {
      result.amplificationFactor = this.suggestedParameters.amplification;
    }
    
    if (this.suggestedParameters.filterStrength !== undefined) {
      result.filterStrength = this.suggestedParameters.filterStrength;
    }
    
    if (this.suggestedParameters.sensitivity !== undefined) {
      result.sensitivityFactor = this.suggestedParameters.sensitivity;
    }
    
    return result;
  }
  
  /**
   * Reinicia el calculador
   */
  public reset(): void {
    this.lastCalculation = null;
    this.valueBuffer = [];
    this.suggestedParameters = {};
  }
  
  /**
   * Calcula calidad de señal basado en estabilidad y rango
   */
  protected calculateSignalQuality(values: number[]): number {
    if (values.length < 5) return 0.5;
    
    // Analizar ventana reciente
    const recentValues = values.slice(-10);
    
    // Calcular rango
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;
    
    // Calcular desviación estándar
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalizar desviación
    const normalizedStdDev = Math.min(1, stdDev / (range + 0.001));
    
    // Calcular calidad en función de rango y estabilidad
    const rangeQuality = Math.min(1, range * 5);
    const stabilityQuality = 1 - normalizedStdDev;
    
    // Combinar factores
    return (rangeQuality * 0.6) + (stabilityQuality * 0.4);
  }
  
  protected maintainBufferSize() {
    if (this.valueBuffer.length > this._maxBufferSize) {
      this.valueBuffer.shift();
    }
  }
}
