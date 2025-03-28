
/**
 * Calculador Base
 * Proporciona funcionalidad común para todos los calculadores de signos vitales
 */

import { OptimizedSignal } from '../../../../modules/signal-optimization/types';
import { CalculationResultItem, BaseCalculator, VitalSignCalculator, VitalSignCalculation, FeedbackData } from '../types';

/**
 * Clase base abstracta para calculadores de signos vitales
 */
export abstract class BaseVitalSignCalculator implements VitalSignCalculator {
  protected config: VitalSignCalculation;
  protected channelName: string;
  protected confidence: number = 0;
  protected lastCalculation: CalculationResultItem | null = null;
  protected valueBuffer: number[] = [];
  protected _maxBufferSize: number = 120;
  protected suggestedParameters: Record<string, number> = {};
  
  constructor(channelName: string, bufferSize: number = 120) {
    this.channelName = channelName;
    this._maxBufferSize = bufferSize;
    this.config = {
      minValue: 0,
      maxValue: 100,
      confidenceThreshold: 0.6,
      defaultValue: 0
    };
  }
  
  /**
   * Obtiene el nombre del canal
   */
  public getChannelName(): string {
    return this.channelName;
  }
  
  /**
   * Obtiene nivel de confianza actual
   */
  public getConfidenceLevel(): number {
    return this.confidence;
  }
  
  /**
   * Calcula el signo vital a partir de una señal optimizada
   */
  public calculate(signal: OptimizedSignal): CalculationResultItem {
    try {
      // Añadir valor al buffer
      this.addToBuffer(signal.value);
      
      // Validar señal
      if (!signal || signal.value === 0) {
        return this.getDefaultResult();
      }
      
      // Calcular resultado específico
      const result = this.performCalculation(signal);
      
      // Actualizar confianza basado en resultado y señal
      this.confidence = Math.min(signal.confidence, result.confidence);
      
      // Guardar último cálculo
      this.lastCalculation = {
        value: result.value,
        confidence: result.confidence,
        metadata: result.metadata
      };
      
      return this.lastCalculation;
    } catch (error) {
      console.error(`Error calculando ${this.channelName}:`, error);
      return this.getDefaultResult();
    }
  }
  
  /**
   * Genera feedback para el optimizador
   */
  public generateFeedback(): FeedbackData | null {
    if (!this.lastCalculation || this.confidence > 0.8) {
      return null;
    }
    
    // Generar feedback basado en último cálculo
    return {
      channel: this.channelName as any,
      adjustment: this.confidence < 0.4 ? 'increase' : 'fine-tune',
      magnitude: 1 - this.confidence,
      confidence: this.confidence,
      parameter: this.getPreferredParameter()
    };
  }
  
  /**
   * Añade un valor al buffer, manteniendo el tamaño máximo
   */
  protected addToBuffer(value: number): void {
    this.valueBuffer.push(value);
    
    // Mantener tamaño de buffer limitado
    if (this.valueBuffer.length > this._maxBufferSize) {
      this.valueBuffer.shift();
    }
  }
  
  /**
   * Calcula calidad de señal basado en buffer de valores
   */
  protected calculateSignalQuality(values: number[]): number {
    if (values.length < 10) return 0.3;
    
    // Calcular varianza normalizada como medida de calidad
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    // Normalizar varianza a [0,1]
    // Varianza baja o muy alta indican baja calidad
    const normalizedVariance = Math.min(variance / 0.5, 1.0);
    
    // Convertir a medida de calidad (varianza óptima en rango medio)
    let quality = 0;
    if (normalizedVariance < 0.1) {
      // Varianza muy baja - calidad baja
      quality = normalizedVariance * 5;
    } else if (normalizedVariance < 0.5) {
      // Varianza óptima - calidad alta
      quality = 0.5 + (normalizedVariance - 0.1) * 1.25;
    } else {
      // Varianza alta - calidad baja
      quality = 1.0 - (normalizedVariance - 0.5) * 1.0;
    }
    
    return Math.max(0.1, Math.min(0.95, quality));
  }
  
  /**
   * Reinicia el calculador
   */
  public reset(): void {
    this.confidence = 0;
    this.lastCalculation = null;
    this.valueBuffer = [];
    this.resetSpecific();
  }
  
  /**
   * Método específico para cálculo del signo vital
   * Debe ser implementado por cada calculador
   */
  protected abstract performCalculation(signal: OptimizedSignal): VitalSignCalculation;
  
  /**
   * Método específico para reinicio del calculador
   */
  protected abstract resetSpecific(): void;
  
  /**
   * Obtiene el parámetro preferido para ajuste
   */
  protected abstract getPreferredParameter(): string;
  
  /**
   * Obtiene resultado por defecto
   */
  protected getDefaultResult(): CalculationResultItem {
    return {
      value: this.config.defaultValue,
      confidence: 0
    };
  }
}

// Export the BaseCalculator type as well for compatibility
export { BaseVitalSignCalculator as BaseCalculator };
