
/**
 * Calculador Base
 * Proporciona funcionalidad común para todos los calculadores de signos vitales
 */

import { OptimizedSignal } from '../../../../modules/signal-optimization/types';
import { CalculationResultItem, VitalSignCalculator, VitalSignCalculation, FeedbackData } from '../types';

/**
 * Clase base abstracta para calculadores de signos vitales
 */
export abstract class BaseVitalSignCalculator implements VitalSignCalculator {
  protected config: VitalSignCalculation;
  private channelName: string;
  private confidence: number = 0;
  private lastCalculation: CalculationResultItem | null = null;
  
  constructor(channelName: string, config: VitalSignCalculation) {
    this.channelName = channelName;
    this.config = config;
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
      // Validar señal
      if (!signal || signal.value === 0) {
        return this.getDefaultResult();
      }
      
      // Calcular resultado específico
      const result = this.calculateVitalSign(signal);
      
      // Actualizar confianza basado en resultado y señal
      this.confidence = Math.min(signal.confidence, result.confidence);
      
      // Guardar último cálculo
      this.lastCalculation = result;
      
      return result;
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
   * Reinicia el calculador
   */
  public reset(): void {
    this.confidence = 0;
    this.lastCalculation = null;
    this.resetSpecific();
  }
  
  /**
   * Método específico para cálculo del signo vital
   * Debe ser implementado por cada calculador
   */
  protected abstract calculateVitalSign(signal: OptimizedSignal): CalculationResultItem;
  
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
