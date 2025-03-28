
/**
 * Base calculator para todos los calculadores de signos vitales
 */

import { BaseCalculator as IBaseCalculator, CalculationResultItem } from '../types';
import { OptimizedSignal } from '../../../signal-optimization/types';

/**
 * Clase base para todos los calculadores de signos vitales
 */
export class BaseCalculator implements IBaseCalculator {
  protected valueBuffer: number[] = [];
  protected _maxBufferSize: number = 30;
  protected lastCalculatedValue: number | string | null = null;
  protected lastConfidence: number = 0;
  protected suggestedParameters: Record<string, any> = {};
  
  /**
   * Realiza el cálculo con la señal optimizada
   */
  public calculate(signal: OptimizedSignal): CalculationResultItem {
    // Implementación base que debe ser sobreescrita por las clases hijas
    return {
      value: 0,
      confidence: 0
    };
  }
  
  /**
   * Reinicia el calculador
   */
  public reset(): void {
    this.valueBuffer = [];
    this.lastCalculatedValue = null;
    this.lastConfidence = 0;
    this.suggestedParameters = {};
  }
  
  /**
   * Calcula la calidad de la señal basado en el buffer de valores
   */
  protected calculateSignalQuality(values: number[]): number {
    if (values.length < 3) return 0;
    
    // Calcular varianza de la señal
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    // Calcular coeficiente de variación
    const stdDev = Math.sqrt(variance);
    const cv = mean !== 0 ? stdDev / Math.abs(mean) : 1;
    
    // Convertir a medida de calidad (menor CV = mayor calidad)
    const quality = Math.max(0, Math.min(1, 1 - cv));
    
    return quality * 100;
  }
}
