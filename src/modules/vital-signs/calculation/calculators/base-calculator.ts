
/**
 * Calculador base para todos los calculadores específicos
 */

import { OptimizedSignal } from '../../../signal-optimization/types';
import { CalculationResultItem } from '../types';

/**
 * Clase base para todos los calculadores
 * Proporciona funcionalidad común y estado compartido
 */
export abstract class BaseCalculator {
  protected valueBuffer: number[] = [];
  protected _maxBufferSize: number = 30;
  protected lastCalculatedValue: number = 0;
  protected lastConfidence: number = 0;
  protected suggestedParameters: Record<string, number> = {};
  
  /**
   * Calcula resultado a partir de señal optimizada
   */
  public abstract calculate(signal: OptimizedSignal): CalculationResultItem;
  
  /**
   * Reinicia estado interno
   */
  public reset(): void {
    this.valueBuffer = [];
    this.lastCalculatedValue = 0;
    this.lastConfidence = 0;
    this.suggestedParameters = {};
  }
  
  /**
   * Calcula calidad de la señal basada en buffer de valores
   */
  protected calculateSignalQuality(values: number[]): number {
    if (values.length < 5) return 50;
    
    // Calcular varianza como indicador de calidad
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    // Coeficiente de variación como porcentaje
    const cv = Math.sqrt(variance) / mean * 100;
    
    // Calidad inversa a variabilidad (menos variación = mayor calidad)
    // Limitar a 0-100
    return Math.max(0, Math.min(100, 100 - cv));
  }
}
