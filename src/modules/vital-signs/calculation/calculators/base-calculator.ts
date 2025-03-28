
/**
 * Calculador base para todos los signos vitales
 * Proporciona funcionalidad común para todos los calculadores
 */

import { CalculationResultItem, BaseCalculator } from '../types';
import { OptimizedSignal } from '../../../signal-optimization/types';

export abstract class BaseVitalSignCalculator implements BaseCalculator {
  protected valueBuffer: number[] = [];
  protected readonly _maxBufferSize: number = 100;
  protected suggestedParameters: Record<string, any> = {};
  
  /**
   * Calcula el resultado del signo vital a partir de la señal optimizada
   */
  public abstract calculate(signal: OptimizedSignal): CalculationResultItem;
  
  /**
   * Reinicia el calculador
   */
  public reset(): void {
    this.valueBuffer = [];
    this.suggestedParameters = {};
  }
  
  /**
   * Obtiene el nombre del canal para este calculador
   */
  public abstract getChannelName(): string;
  
  /**
   * Obtiene el nivel de confianza actual
   */
  public abstract getConfidenceLevel(): number;
  
  /**
   * Evalúa la calidad de señal
   */
  protected calculateSignalQuality(values: number[]): number {
    if (values.length < 10) return 30;
    
    // Calcular estadísticas de señal
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / (Math.abs(mean) || 0.001);
    
    // Criterios de calidad
    let quality = 50;
    
    // Penalizar señales de muy baja variabilidad
    if (cv < 0.05) {
      quality -= 20;
    }
    // Recompensar variabilidad moderada
    else if (cv >= 0.05 && cv < 0.4) {
      quality += 20;
    }
    // Penalizar alta variabilidad (señal ruidosa)
    else if (cv >= 0.8) {
      quality -= 30;
    }
    
    // Ajustar basado en rango
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    if (range < 0.05) {
      quality -= 30;
    } else if (range >= 0.1 && range < 0.5) {
      quality += 15;
    }
    
    return Math.max(0, Math.min(100, quality));
  }
  
  /**
   * Añade un valor al buffer
   */
  protected addValue(value: number): void {
    this.valueBuffer.push(value);
    if (this.valueBuffer.length > this._maxBufferSize) {
      this.valueBuffer.shift();
    }
  }
}
