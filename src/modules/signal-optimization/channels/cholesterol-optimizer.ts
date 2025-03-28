
/**
 * Optimizador especializado para el canal de colesterol
 */

import { ProcessedPPGSignal } from '../../signal-processing/types';
import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { FeedbackData, OptimizationParameters } from '../types';

/**
 * Parámetros específicos para optimización de colesterol
 */
const CHOLESTEROL_PARAMS: Partial<OptimizationParameters> = {
  amplificationFactor: 1.5,
  filterStrength: 0.75,
  frequencyRange: [0.25, 2.2],
  sensitivityFactor: 1.3,
  adaptiveThreshold: true
};

/**
 * Optimizador especializado para mejorar las características 
 * relacionadas con colesterol
 */
export class CholesterolOptimizer extends BaseChannelOptimizer {
  // Factores específicos para análisis de colesterol
  private viscosityEstimation: number = 1.0;
  private waveformDistortion: number = 0;
  private attenuationFactor: number = 1.0;
  
  constructor() {
    super('cholesterol', CHOLESTEROL_PARAMS);
  }
  
  /**
   * Aplica optimizaciones específicas para colesterol
   * Enfocado en características de forma de onda y atenuación
   */
  protected applyChannelSpecificOptimizations(signal: ProcessedPPGSignal): number {
    // 1. Filtrado para reducir ruido
    let optimized = this.applyAdaptiveFilter(signal.filteredValue);
    
    // 2. Calcular estimadores indirectos (viscosidad, distorsión)
    this.calculateViscosityEstimators(optimized);
    
    // 3. Aplicar correcciones basadas en características
    optimized = this.applyViscosityCorrections(optimized);
    
    // 4. Amplificación adaptativa
    optimized = this.amplifySignal(optimized);
    
    return optimized;
  }
  
  /**
   * Calcula estimadores indirectos relacionados con colesterol
   */
  private calculateViscosityEstimators(value: number): void {
    if (this.valueBuffer.length < 15) return;
    
    // Análisis de forma de onda para detectar distorsión (relacionada con viscosidad)
    const segment = this.valueBuffer.slice(-15);
    
    // Calcular asimetría en forma de onda (skewness)
    const mean = segment.reduce((a, b) => a + b, 0) / segment.length;
    
    let sumCube = 0;
    let sumSquare = 0;
    for (const val of segment) {
      const deviation = val - mean;
      sumCube += Math.pow(deviation, 3);
      sumSquare += Math.pow(deviation, 2);
    }
    
    const stdDev = Math.sqrt(sumSquare / segment.length);
    
    // Evitar división por cero
    if (stdDev > 0) {
      // Skewness = momento de tercer orden normalizado
      const skewness = (sumCube / segment.length) / Math.pow(stdDev, 3);
      
      // Distorsión = valor absoluto de asimetría
      this.waveformDistortion = Math.abs(skewness);
      
      // Estimar "viscosidad" basado en distorsión y características temporales
      const diffSum = segment.slice(1).reduce((sum, val, i) => 
        sum + Math.abs(val - segment[i]), 0);
      
      const smoothness = 1 - (diffSum / (segment.length - 1)) * 10;
      
      // Combinación ponderada para estimación
      this.viscosityEstimation = 
        (this.waveformDistortion * 0.6) + (smoothness * 0.4);
      
      // Limitar a rango razonable
      this.viscosityEstimation = Math.max(0.5, Math.min(2.0, this.viscosityEstimation));
      
      // Factor de atenuación inversamente proporcional a viscosidad
      this.attenuationFactor = 1 / Math.sqrt(this.viscosityEstimation);
    }
  }
  
  /**
   * Aplica correcciones basadas en estimadores de viscosidad
   */
  private applyViscosityCorrections(value: number): number {
    if (this.valueBuffer.length < 10) return value;
    
    // Compensar atenuación relacionada con viscosidad
    const viscosityCompensated = value * this.attenuationFactor;
    
    // Adjustar forma de pulso basado en distorsión
    const pulseShapeAdjustment = 
      this.waveformDistortion > 1.2 ? 0.1 : this.waveformDistortion > 0.8 ? 0.05 : 0;
    
    // Aplicar ajustes
    const corrected = viscosityCompensated + pulseShapeAdjustment;
    
    return Math.max(0, Math.min(1, corrected));
  }
  
  /**
   * Procesamiento especializado de feedback para colesterol
   */
  protected adaptToFeedback(feedback: FeedbackData): void {
    super.adaptToFeedback(feedback);
    
    // Adaptaciones específicas para colesterol
    if (feedback.confidence < 0.3) {
      // Ajustar atenuación
      this.attenuationFactor = Math.min(1.5, this.attenuationFactor * 1.1);
    } else if (feedback.confidence > 0.8) {
      // Restaurar a valores calculados
      this.attenuationFactor = 1 / Math.sqrt(this.viscosityEstimation);
    }
  }
  
  /**
   * Reinicia parámetros específicos
   */
  protected resetChannelParameters(): void {
    super.resetChannelParameters();
    this.setParameters(CHOLESTEROL_PARAMS);
    this.viscosityEstimation = 1.0;
    this.waveformDistortion = 0;
    this.attenuationFactor = 1.0;
  }
}
