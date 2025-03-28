
/**
 * Calculador especializado para lípidos
 */

import { BaseCalculator } from './base-calculator';
import { VitalSignCalculation } from '../types';
import { OptimizedSignal, VitalSignChannel } from '../../../signal-optimization/types';

export class LipidsCalculator extends BaseCalculator {
  private readonly lipidType: 'cholesterol' | 'triglycerides';
  private waveformFeatures: {
    symmetry: number;
    areaUnderCurve: number;
    peakWidth: number;
  } = {
    symmetry: 0,
    areaUnderCurve: 0,
    peakWidth: 0
  };
  
  constructor(type: 'cholesterol' | 'triglycerides') {
    super(type as VitalSignChannel);
    this.lipidType = type;
    // Mayor tamaño de buffer para análisis de forma de onda
    this.MAX_BUFFER_SIZE = 120;
  }
  
  /**
   * Calcula nivel de lípidos basado en señal optimizada
   */
  protected performCalculation(signal: OptimizedSignal): VitalSignCalculation {
    // Analizar características de forma de onda
    this.analyzeWaveform();
    
    // Calcular valor basado en características
    const value = this.calculateLipidValue();
    
    // Calcular confianza del resultado
    const confidence = this.calculateConfidence();
    
    // Actualizar sugerencias para optimizador
    this.updateOptimizationSuggestions(confidence);
    
    return {
      value,
      confidence,
      timestamp: signal.timestamp,
      metadata: { ...this.waveformFeatures }
    };
  }
  
  /**
   * Analiza características de forma de onda
   */
  private analyzeWaveform(): void {
    if (this.valueBuffer.length < 30) return;
    
    const window = this.valueBuffer.slice(-30);
    
    // Calcular simetría de la forma de onda
    this.waveformFeatures.symmetry = this.calculateSymmetry(window);
    
    // Calcular área bajo la curva
    this.waveformFeatures.areaUnderCurve = this.calculateAreaUnderCurve(window);
    
    // Calcular ancho de pico
    this.waveformFeatures.peakWidth = this.calculatePeakWidth(window);
  }
  
  /**
   * Calcula simetría de la forma de onda
   */
  private calculateSymmetry(values: number[]): number {
    // Encontrar punto máximo
    let maxIndex = 0;
    let maxValue = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > maxValue) {
        maxValue = values[i];
        maxIndex = i;
      }
    }
    
    // Calcular simetría alrededor del pico
    const leftSize = maxIndex;
    const rightSize = values.length - maxIndex - 1;
    const compareSize = Math.min(leftSize, rightSize);
    
    if (compareSize < 3) return 0.5; // No suficientes datos para comparar
    
    let symmetrySum = 0;
    for (let i = 1; i <= compareSize; i++) {
      const leftVal = values[maxIndex - i];
      const rightVal = values[maxIndex + i];
      const diff = Math.abs(leftVal - rightVal);
      const max = Math.max(leftVal, rightVal);
      
      symmetrySum += diff / (max + 0.001);
    }
    
    // Normalizar a [0,1], donde 1 es perfectamente simétrico
    return Math.max(0, 1 - (symmetrySum / compareSize));
  }
  
  /**
   * Calcula área bajo la curva
   */
  private calculateAreaUnderCurve(values: number[]): number {
    // Baseline como mínimo valor
    const baseline = Math.min(...values);
    
    // Calcular área
    let area = 0;
    for (const value of values) {
      area += value - baseline;
    }
    
    return area / values.length;
  }
  
  /**
   * Calcula ancho de pico
   */
  private calculatePeakWidth(values: number[]): number {
    // Encontrar punto máximo
    let maxIndex = 0;
    let maxValue = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > maxValue) {
        maxValue = values[i];
        maxIndex = i;
      }
    }
    
    // Calcular ancho a media altura
    const halfHeight = (maxValue + Math.min(...values)) / 2;
    
    // Buscar hacia la izquierda
    let leftIndex = maxIndex;
    while (leftIndex > 0 && values[leftIndex] > halfHeight) {
      leftIndex--;
    }
    
    // Buscar hacia la derecha
    let rightIndex = maxIndex;
    while (rightIndex < values.length - 1 && values[rightIndex] > halfHeight) {
      rightIndex++;
    }
    
    // Ancho normalizado al tamaño de ventana
    return (rightIndex - leftIndex) / values.length;
  }
  
  /**
   * Calcula valor de lípidos basado en características
   */
  private calculateLipidValue(): number {
    if (this.valueBuffer.length < 60) {
      return 0; // No suficientes datos
    }
    
    // Coeficientes específicos por tipo de lípido
    const coefficients = this.lipidType === 'cholesterol' ? 
      { base: 150, symm: 50, area: 30, width: 20 } :
      { base: 100, symm: 40, area: 50, width: 10 };
    
    // Calcular valor basado en características
    const value = coefficients.base +
                 (coefficients.symm * (1 - this.waveformFeatures.symmetry)) +
                 (coefficients.area * this.waveformFeatures.areaUnderCurve) -
                 (coefficients.width * this.waveformFeatures.peakWidth);
    
    // Limitar a rangos fisiológicos
    if (this.lipidType === 'cholesterol') {
      // Colesterol: 120-300 mg/dL
      return Math.max(120, Math.min(300, value));
    } else {
      // Triglicéridos: 50-250 mg/dL
      return Math.max(50, Math.min(250, value));
    }
  }
  
  /**
   * Calcula confianza del resultado
   */
  private calculateConfidence(): number {
    if (this.valueBuffer.length < 60) {
      return this.valueBuffer.length / 120; // Confianza proporcional a cantidad de datos
    }
    
    // Factores de confianza
    
    // 1. Cantidad de muestras
    const sampleConfidence = Math.min(1, this.valueBuffer.length / this.MAX_BUFFER_SIZE);
    
    // 2. Calidad de señal
    const signalQuality = this.calculateSignalQuality(this.valueBuffer);
    
    // 3. Estabilidad de características
    const featureStability = this.calculateFeatureStability();
    
    // Combinar factores
    return (sampleConfidence * 0.3) + (signalQuality * 0.4) + (featureStability * 0.3);
  }
  
  /**
   * Calcula estabilidad de características
   */
  private calculateFeatureStability(): number {
    // Para calcular estabilidad, necesitaríamos histórico de características
    // Simplificando, usamos una medida de estabilidad basada en buffer actual
    
    if (this.valueBuffer.length < 30) return 0.5;
    
    // Dividir buffer en segmentos
    const segments = 3;
    const segmentSize = Math.floor(this.valueBuffer.length / segments);
    const segmentFeatures = [];
    
    // Calcular características por segmento
    for (let i = 0; i < segments; i++) {
      const start = i * segmentSize;
      const segment = this.valueBuffer.slice(start, start + segmentSize);
      
      segmentFeatures.push({
        symmetry: this.calculateSymmetry(segment),
        areaUnderCurve: this.calculateAreaUnderCurve(segment),
        peakWidth: this.calculatePeakWidth(segment)
      });
    }
    
    // Calcular variación entre segmentos
    let variationSum = 0;
    for (let i = 1; i < segmentFeatures.length; i++) {
      const curr = segmentFeatures[i];
      const prev = segmentFeatures[i-1];
      
      variationSum += 
        Math.abs(curr.symmetry - prev.symmetry) +
        Math.abs(curr.areaUnderCurve - prev.areaUnderCurve) +
        Math.abs(curr.peakWidth - prev.peakWidth);
    }
    
    // Normalizar variación a [0,1]
    const maxVariation = 3 * (segments - 1); // 3 características * (segments-1) comparaciones
    const normalizedVariation = Math.min(1, variationSum / maxVariation);
    
    // Alta estabilidad = baja variación
    return 1 - normalizedVariation;
  }
  
  /**
   * Actualiza sugerencias para optimizador
   */
  private updateOptimizationSuggestions(confidence: number): void {
    if (confidence < 0.3) {
      // Baja confianza: mejorar detección de características
      this.suggestedParameters = {
        amplification: 1.4,
        filterStrength: 0.7,
        sensitivity: 1.2
      };
    } else if (confidence < 0.6) {
      // Confianza media: ajustes moderados
      this.suggestedParameters = {
        amplification: 1.2,
        filterStrength: 0.6,
        sensitivity: 1.0
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
    this.waveformFeatures = {
      symmetry: 0,
      areaUnderCurve: 0,
      peakWidth: 0
    };
  }
}
