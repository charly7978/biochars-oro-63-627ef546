
/**
 * Optimizador especializado para el canal de glucosa
 */

import { ProcessedPPGSignal } from '../../signal-processing/types';
import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { FeedbackData, OptimizationParameters } from '../types';

/**
 * Parámetros específicos para optimización de glucosa
 */
const GLUCOSE_PARAMS: Partial<OptimizationParameters> = {
  // Enfocado en atenuación y absorción diferencial
  amplificationFactor: 1.3,
  filterStrength: 0.7,
  frequencyRange: [0.2, 2.0], // Rango más amplio para capturar variaciones lentas
  sensitivityFactor: 1.4,
  adaptiveThreshold: true
};

/**
 * Optimizador especializado para mejorar las características 
 * relacionadas con glucosa
 */
export class GlucoseOptimizer extends BaseChannelOptimizer {
  // Factores específicos para análisis de glucosa
  private baselineValue: number = 0;
  private absorptionFactor: number = 1.0;
  private variationHistory: number[] = [];
  
  constructor() {
    super('glucose', GLUCOSE_PARAMS);
  }
  
  /**
   * Aplica optimizaciones específicas para glucosa
   * Enfocado en características de absorción y variación lenta
   */
  protected applyChannelSpecificOptimizations(signal: ProcessedPPGSignal): number {
    // 1. Filtrado para reducir ruido
    let optimized = this.applyAdaptiveFilter(signal.filteredValue);
    
    // 2. Actualizar línea base y factor de absorción
    this.updateBaseline(optimized);
    
    // 3. Normalizar con respecto a línea base
    optimized = this.normalizeWithBaseline(optimized);
    
    // 4. Realzar variaciones lentas (relacionadas con glucosa)
    optimized = this.enhanceSlowVariations(optimized);
    
    // 5. Amplificación adaptativa
    optimized = this.amplifySignal(optimized);
    
    return optimized;
  }
  
  /**
   * Actualiza línea base y factor de absorción
   */
  private updateBaseline(value: number): void {
    if (this.valueBuffer.length < 20) {
      this.baselineValue = value;
      return;
    }
    
    // Línea base = promedio móvil de ventana larga
    const baselineBufferSize = Math.min(this.valueBuffer.length, 30);
    const baselineValues = this.valueBuffer.slice(-baselineBufferSize);
    
    // Actualización gradual de línea base (alpha bajo)
    const alpha = 0.05;
    const newBaseline = baselineValues.reduce((sum, val) => sum + val, 0) / baselineValues.length;
    this.baselineValue = (1 - alpha) * this.baselineValue + alpha * newBaseline;
    
    // Estimar factor de absorción basado en distribución de valores
    const variances: number[] = [];
    for (let i = 1; i < baselineValues.length; i++) {
      variances.push(Math.abs(baselineValues[i] - baselineValues[i-1]));
    }
    
    // Ordenar variaciones para análisis de percentiles
    variances.sort((a, b) => a - b);
    
    // Usar percentil 75 como estimador de absorción
    const p75Index = Math.floor(variances.length * 0.75);
    this.absorptionFactor = variances.length > 0 ? variances[p75Index] * 20 : 1.0;
    
    // Limitar a rango razonable
    this.absorptionFactor = Math.max(0.8, Math.min(1.8, this.absorptionFactor));
    
    // Actualizar historial de variaciones
    const currentVariation = Math.abs(value - this.baselineValue);
    this.variationHistory.push(currentVariation);
    if (this.variationHistory.length > 50) {
      this.variationHistory.shift();
    }
  }
  
  /**
   * Normaliza el valor con respecto a la línea base
   */
  private normalizeWithBaseline(value: number): number {
    if (this.baselineValue === 0) return value;
    
    // Normalizar como desviación de línea base
    const deviation = value - this.baselineValue;
    
    // Escalar según factor de absorción y sensibilidad del canal
    const scaledDeviation = deviation * this.absorptionFactor * this.parameters.sensitivityFactor;
    
    // Retornar valor en rango [0,1]
    return Math.max(0, Math.min(1, 0.5 + scaledDeviation));
  }
  
  /**
   * Realza variaciones lentas relacionadas con glucosa
   */
  private enhanceSlowVariations(value: number): number {
    if (this.variationHistory.length < 10) return value;
    
    // Detectar variaciones lentas (ventana amplia)
    const shortTermAvg = this.variationHistory.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const longTermAvg = this.variationHistory.slice(-20).reduce((a, b) => a + b, 0) / 20;
    
    // Calcular tendencia (positiva = variaciones aumentando, negativa = disminuyendo)
    const trend = shortTermAvg - longTermAvg;
    
    // Realzar según tendencia
    const enhancementFactor = 1 + Math.abs(trend) * 5;
    
    // Aplicar realce
    const centered = value - 0.5;
    const enhanced = centered * enhancementFactor;
    
    return Math.max(0, Math.min(1, enhanced + 0.5));
  }
  
  /**
   * Procesamiento especializado de feedback para glucosa
   */
  protected adaptToFeedback(feedback: FeedbackData): void {
    super.adaptToFeedback(feedback);
    
    // Adaptaciones específicas para glucosa
    if (feedback.confidence < 0.3) {
      // Con baja confianza, aumentar sensibilidad
      this.parameters.sensitivityFactor = Math.min(2.0, this.parameters.sensitivityFactor * 1.1);
    } else if (feedback.confidence > 0.7) {
      // Con alta confianza, estabilizar
      this.parameters.sensitivityFactor = 1.4; // Valor óptimo para glucosa
    }
  }
  
  /**
   * Reinicia parámetros específicos
   */
  protected resetChannelParameters(): void {
    super.resetChannelParameters();
    this.setParameters(GLUCOSE_PARAMS);
    this.baselineValue = 0;
    this.absorptionFactor = 1.0;
    this.variationHistory = [];
  }
}
