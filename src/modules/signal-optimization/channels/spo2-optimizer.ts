
/**
 * Optimizador especializado para el canal de SpO2
 */

import { ProcessedPPGSignal } from '../../signal-processing/types';
import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { FeedbackData, OptimizationParameters } from '../types';

/**
 * Parámetros específicos para optimización de SpO2
 */
const SPO2_PARAMS: Partial<OptimizationParameters> = {
  // Enfocado en preservar componentes AC/DC para cálculo de SpO2
  amplificationFactor: 1.4,
  filterStrength: 0.7,
  frequencyRange: [0.5, 2.5], // Rango más estrecho
  sensitivityFactor: 1.1,
  adaptiveThreshold: true
};

/**
 * Optimizador especializado para mejorar cálculo de SpO2
 */
export class SPO2Optimizer extends BaseChannelOptimizer {
  // Factores específicos para SpO2
  private dcComponent: number = 0;
  private acComponent: number = 0;
  private perfusionFactor: number = 1.0;
  
  constructor() {
    super('spo2', SPO2_PARAMS);
  }
  
  /**
   * Aplica optimizaciones específicas para SpO2
   * Enfocado en preservar proporción AC/DC para cálculo preciso
   */
  protected applyChannelSpecificOptimizations(signal: ProcessedPPGSignal): number {
    // 1. Filtrado adaptativo suave para preservar componentes
    let optimized = this.applyAdaptiveFilter(signal.filteredValue);
    
    // 2. Extraer componentes AC y DC para cálculo de perfusión
    this.extractACDCComponents(optimized);
    
    // 3. Normalización preservando relación AC/DC
    optimized = this.normalizeWithPerfusionPreservation(optimized);
    
    // 4. Amplificación conservadora para no distorsionar relación AC/DC
    optimized = this.adaptiveAmplification(optimized);
    
    return optimized;
  }
  
  /**
   * Extrae componentes AC y DC de la señal
   */
  private extractACDCComponents(value: number): void {
    if (this.valueBuffer.length < 5) {
      this.dcComponent = value;
      this.acComponent = 0;
      return;
    }
    
    // Extracción de componente DC (media móvil de ventana larga)
    const dcBufferSize = Math.min(this.valueBuffer.length, 15);
    const recentValues = this.valueBuffer.slice(-dcBufferSize);
    this.dcComponent = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Extracción de componente AC (diferencia de pico a pico en ventana corta)
    const acBufferSize = Math.min(this.valueBuffer.length, 8);
    const shortTermValues = this.valueBuffer.slice(-acBufferSize);
    const min = Math.min(...shortTermValues);
    const max = Math.max(...shortTermValues);
    this.acComponent = max - min;
    
    // Calcular índice de perfusión (PI = AC/DC)
    this.perfusionFactor = this.dcComponent !== 0 ? this.acComponent / this.dcComponent : 0;
  }
  
  /**
   * Normaliza preservando índice de perfusión
   */
  private normalizeWithPerfusionPreservation(value: number): number {
    if (this.valueBuffer.length < 5) return value;
    
    // Normalizar el valor actual preservando relación con DC
    const normalizedValue = (value - this.dcComponent) / (this.acComponent + 0.001);
    
    // Ajustar a rango [0,1] preservando la proporción
    return Math.max(0, Math.min(1, normalizedValue * 0.5 + 0.5));
  }
  
  /**
   * Amplificación adaptativa según índice de perfusión
   */
  private adaptiveAmplification(value: number): number {
    // Menor amplificación con perfusión alta para evitar saturación
    // Mayor amplificación con perfusión baja para mejorar detección
    const adaptiveFactor = this.perfusionFactor > 0.02 
      ? Math.min(1.3, this.parameters.amplificationFactor * 0.8)
      : Math.max(1.6, this.parameters.amplificationFactor * 1.2);
    
    // Normalizar alrededor de 0.5
    const normalized = value - 0.5;
    
    // Amplificar con factor adaptativo
    const amplified = normalized * adaptiveFactor;
    
    // Devolver a rango [0,1]
    return Math.max(0, Math.min(1, amplified + 0.5));
  }
  
  /**
   * Procesamiento especializado de feedback para SpO2
   */
  protected adaptToFeedback(feedback: FeedbackData): void {
    super.adaptToFeedback(feedback);
    
    // Ajustes específicos para SpO2 basados en retroalimentación
    if (feedback.confidence < 0.4) {
      // Aumentar preservación de componentes AC/DC
      this.parameters.filterStrength = Math.max(0.5, this.parameters.filterStrength * 0.9);
    }
  }
  
  /**
   * Reinicia parámetros específicos
   */
  protected resetChannelParameters(): void {
    super.resetChannelParameters();
    this.setParameters(SPO2_PARAMS);
    this.dcComponent = 0;
    this.acComponent = 0;
    this.perfusionFactor = 1.0;
  }
}
