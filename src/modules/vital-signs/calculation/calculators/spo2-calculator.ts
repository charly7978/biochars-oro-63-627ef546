/**
 * Calculador especializado para SpO2
 */

import { BaseCalculator } from './base-calculator';
import { VitalSignCalculation } from '../types';
import { OptimizedSignal } from '../../../signal-optimization/types';

export class SPO2Calculator extends BaseCalculator {
  private acComponent: number = 0;
  private dcComponent: number = 0;
  private perfusionIndex: number = 0;
  private readonly MIN_PERFUSION_INDEX = 0.15;
  
  constructor() {
    super('spo2');
    // Aumentar tamaño de buffer para cálculos de SpO2
    this._maxBufferSize = 90;
  }
  
  /**
   * Calcula SpO2 basado en señal optimizada
   */
  protected performCalculation(signal: OptimizedSignal): VitalSignCalculation {
    // Extraer componentes AC/DC de la señal
    this.extractACDCComponents();
    
    // Calcular índice de perfusión
    this.calculatePerfusionIndex();
    
    // Calcular ratio R para SpO2
    const ratio = this.calculateRatio();
    
    // Convertir ratio a SpO2 usando la curva de calibración
    const spo2 = this.ratioToSpO2(ratio);
    
    // Calcular confianza basada en perfusión y estabilidad
    const confidence = this.calculateConfidence();
    
    // Actualizar sugerencias para optimizador
    this.updateOptimizationSuggestions(confidence);
    
    return {
      value: spo2,
      confidence,
      timestamp: signal.timestamp,
      metadata: {
        perfusionIndex: this.perfusionIndex,
        ratio
      }
    };
  }
  
  /**
   * Extrae componentes AC y DC de la señal
   */
  private extractACDCComponents(): void {
    if (this.valueBuffer.length < 30) {
      return;
    }
    
    // Usar ventana reciente para cálculos
    const window = this.valueBuffer.slice(-30);
    
    // DC es el valor medio
    this.dcComponent = window.reduce((sum, val) => sum + val, 0) / window.length;
    
    // AC es la diferencia entre máximo y mínimo
    const min = Math.min(...window);
    const max = Math.max(...window);
    this.acComponent = max - min;
  }
  
  /**
   * Calcula índice de perfusión (AC/DC)
   */
  private calculatePerfusionIndex(): void {
    if (this.dcComponent === 0) {
      this.perfusionIndex = 0;
      return;
    }
    
    // PI = AC/DC * 100%
    this.perfusionIndex = (this.acComponent / this.dcComponent) * 100;
  }
  
  /**
   * Calcula el ratio R para SpO2
   */
  private calculateRatio(): number {
    // R = (AC/DC)660 / (AC/DC)940
    // Para simplificar, usamos un modelo que aproxima este ratio
    // basado en la forma de la señal PPG y su perfusión
    
    if (this.perfusionIndex < this.MIN_PERFUSION_INDEX) {
      return 1.0; // Valor por defecto para baja perfusión
    }
    
    // Análisis de forma de onda
    const windowSize = Math.min(30, this.valueBuffer.length);
    const window = this.valueBuffer.slice(-windowSize);
    
    // Características de la forma de onda
    const skewness = this.calculateSkewness(window);
    const kurtosis = this.calculateKurtosis(window);
    
    // Ajuste empírico para estimar ratio R
    // Valores bajos de R corresponden a alta saturación
    const estimatedRatio = 0.9 - (0.02 * this.perfusionIndex) + (0.15 * skewness);
    
    // Limitar a rango válido
    return Math.max(0.3, Math.min(1.2, estimatedRatio));
  }
  
  /**
   * Calcula asimetría (skewness) de la distribución
   */
  private calculateSkewness(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const diffSum = values.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    if (variance === 0) return 0;
    
    const stdDev = Math.sqrt(variance);
    return diffSum / (values.length * Math.pow(stdDev, 3));
  }
  
  /**
   * Calcula kurtosis de la distribución
   */
  private calculateKurtosis(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const diffSum = values.reduce((sum, val) => sum + Math.pow(val - mean, 4), 0);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    if (variance === 0) return 0;
    
    return diffSum / (values.length * Math.pow(variance, 2));
  }
  
  /**
   * Convierte ratio R a valor de SpO2
   */
  private ratioToSpO2(ratio: number): number {
    // Curva de calibración empírica:
    // SpO2 = 110 - 25 * R (aproximación de la calibración estándar)
    let spo2 = 110 - (25 * ratio);
    
    // Limitar a rango fisiológico [70-100]
    spo2 = Math.max(70, Math.min(100, spo2));
    
    // Redondear a entero
    return Math.round(spo2);
  }
  
  /**
   * Calcula confianza del resultado
   */
  private calculateConfidence(): number {
    if (this.valueBuffer.length < 20) {
      return 0.3; // Confianza baja con pocas muestras
    }
    
    // Factores de confianza
    
    // 1. Perfusión
    const perfusionConfidence = Math.min(1.0, this.perfusionIndex / 5.0);
    
    // 2. Estabilidad de señal
    const signalQuality = this.calculateSignalQuality(this.valueBuffer);
    
    // 3. Cantidad de muestras
    const sampleConfidence = Math.min(1.0, this.valueBuffer.length / this._maxBufferSize);
    
    // Combinar factores (perfusión es crítico para SpO2)
    return (perfusionConfidence * 0.5) + (signalQuality * 0.3) + (sampleConfidence * 0.2);
  }
  
  /**
   * Actualiza sugerencias para optimizador
   */
  private updateOptimizationSuggestions(confidence: number): void {
    if (confidence < 0.4) {
      // Baja confianza: preservar componentes AC/DC
      this.suggestedParameters = {
        amplification: 1.3,
        filterStrength: 0.5
      };
    } else if (confidence < 0.7) {
      // Confianza media: sugerencias moderadas
      this.suggestedParameters = {
        amplification: 1.2,
        filterStrength: 0.6
      };
    } else {
      // Alta confianza: no sugerir cambios
      this.suggestedParameters = {};
    }
  }
  
  /**
   * Reinicia calculador
   */
  public reset(): void {
    super.reset();
    this.acComponent = 0;
    this.dcComponent = 0;
    this.perfusionIndex = 0;
  }
}
