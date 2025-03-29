
/**
 * Calculador especializado para glucosa
 */

import { OptimizedSignal } from '../../../signal-optimization/types';
import { BaseCalculator, BaseVitalSignCalculator, VitalSignCalculation } from '../types';

export class GlucoseCalculator extends BaseVitalSignCalculator {
  private absorptionRatio: number = 1.0;
  private baselineVariation: number = 0;
  private trendData: number[] = [];
  
  // Add missing properties
  private decayTime: number = 0;
  private peakAmplitude: number = 0;
  private areaUnderCurve: number = 0;
  
  constructor() {
    super('glucose', 120); // Mayor buffer para detectar tendencias lentas
  }
  
  /**
   * Calcula nivel de glucosa basado en señal optimizada
   */
  protected performCalculation(signal: OptimizedSignal): VitalSignCalculation {
    // Analizar dinámica temporal de la señal
    this.analyzeSignalDynamics();
    
    // Calcular nivel de glucosa basado en características
    const glucoseLevel = this.calculateGlucoseLevel();
    
    // Calcular confianza del resultado
    const confidence = this.calculateConfidence();
    
    // Actualizar sugerencias para optimizador
    this.updateOptimizationSuggestions(confidence);
    
    return {
      value: glucoseLevel,
      confidence,
      timestamp: signal.timestamp,
      metadata: {
        decayTime: this.decayTime,
        peakAmplitude: this.peakAmplitude,
        areaUnderCurve: this.areaUnderCurve
      },
      minValue: 70,
      maxValue: 200,
      confidenceThreshold: 0.6,
      defaultValue: 0
    };
  }
  
  /**
   * Analiza dinámica temporal de la señal
   */
  private analyzeSignalDynamics(): void {
    if (this.valueBuffer.length < 60) return;
    
    const window = this.valueBuffer.slice(-60);
    
    // Encontrar amplitud de pico
    this.peakAmplitude = Math.max(...window) - Math.min(...window);
    
    // Calcular área bajo la curva
    const baseline = Math.min(...window);
    this.areaUnderCurve = window.reduce((sum, val) => sum + (val - baseline), 0) / window.length;
    
    // Calcular tiempo de decaimiento
    this.calculateDecayTime(window);
  }
  
  /**
   * Calcula tiempo de decaimiento de picos
   */
  private calculateDecayTime(values: number[]): void {
    // Encontrar picos
    const peaks: number[] = [];
    
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1] && values[i] > 0.4) {
        peaks.push(i);
      }
    }
    
    if (peaks.length < 2) {
      this.decayTime = 0;
      return;
    }
    
    // Calcular tiempo de decaimiento promedio
    let decaySum = 0;
    let decayCount = 0;
    
    for (const peakIndex of peaks) {
      // Buscar cuando la señal cae al 50% del pico
      const peakValue = values[peakIndex];
      const halfPeak = (peakValue + Math.min(...values)) / 2;
      
      let decayIndex = peakIndex;
      while (decayIndex < values.length - 1 && values[decayIndex] > halfPeak) {
        decayIndex++;
      }
      
      if (decayIndex > peakIndex) {
        decaySum += decayIndex - peakIndex;
        decayCount++;
      }
    }
    
    this.decayTime = decayCount > 0 ? decaySum / decayCount : 0;
  }
  
  /**
   * Calcula nivel de glucosa basado en características
   */
  private calculateGlucoseLevel(): number {
    if (this.valueBuffer.length < 90) {
      return 0; // No suficientes datos
    }
    
    // Modelo simple basado en características extraídas
    // Los coeficientes se obtendrían idealmente por calibración
    const baseValue = 90; // mg/dL (valor base)
    
    const decayFactor = 0.5 * this.decayTime;
    const amplitudeFactor = 30 * this.peakAmplitude;
    const areaFactor = 40 * this.areaUnderCurve;
    
    // Cálculo ponderado
    const glucoseValue = baseValue + decayFactor + amplitudeFactor + areaFactor;
    
    // Limitar a rango fisiológico [70-200] mg/dL
    return Math.max(70, Math.min(200, Math.round(glucoseValue)));
  }
  
  /**
   * Calcula confianza del resultado
   */
  private calculateConfidence(): number {
    if (this.valueBuffer.length < 30) {
      return 0.2; // Confianza baja con pocas muestras
    }
    
    // Factores de confianza
    
    // 1. Estabilidad de señal
    const signalQuality = this.calculateSignalQuality(this.valueBuffer);
    
    // 2. Cantidad de muestras
    const sampleConfidence = Math.min(1.0, this.valueBuffer.length / this._maxBufferSize);
    
    // 3. Consistencia de tendencia
    const trendConfidence = this.calculateTrendConsistency();
    
    // Combinar factores
    return (signalQuality * 0.3) + (sampleConfidence * 0.3) + (trendConfidence * 0.4);
  }
  
  /**
   * Calcula factor de estabilidad
   */
  private calculateStabilityFactor(): number {
    if (this.valueBuffer.length < 90) return 0.5;
    
    // Dividir buffer en tres segmentos
    const segmentSize = Math.floor(this.valueBuffer.length / 3);
    const segments = [
      this.valueBuffer.slice(0, segmentSize),
      this.valueBuffer.slice(segmentSize, 2 * segmentSize),
      this.valueBuffer.slice(2 * segmentSize)
    ];
    
    // Calcular características por segmento
    const segmentFeatures = segments.map(segment => {
      const max = Math.max(...segment);
      const min = Math.min(...segment);
      const amplitude = max - min;
      const mean = segment.reduce((sum, val) => sum + val, 0) / segment.length;
      const auc = segment.reduce((sum, val) => sum + (val - min), 0) / segment.length;
      
      return { amplitude, mean, auc };
    });
    
    // Calcular variación entre segmentos
    let variationSum = 0;
    for (let i = 1; i < segmentFeatures.length; i++) {
      const curr = segmentFeatures[i];
      const prev = segmentFeatures[i-1];
      
      const ampVariation = Math.abs(curr.amplitude - prev.amplitude) / Math.max(curr.amplitude, prev.amplitude);
      const meanVariation = Math.abs(curr.mean - prev.mean) / Math.max(curr.mean, prev.mean);
      const aucVariation = Math.abs(curr.auc - prev.auc) / Math.max(curr.auc, prev.auc);
      
      variationSum += ampVariation + meanVariation + aucVariation;
    }
    
    // Normalizar
    const maxVariation = 3 * (segments.length - 1); // 3 características * 2 comparaciones
    const normalizedVariation = Math.min(1, variationSum / maxVariation);
    
    // Alta estabilidad = baja variación
    return 1 - normalizedVariation;
  }
  
  /**
   * Actualiza sugerencias para optimizador
   */
  private updateOptimizationSuggestions(confidence: number): void {
    if (confidence < 0.3) {
      // Baja confianza: enfatizar características temporales
      this.suggestedParameters = {
        amplification: 1.5,
        filterStrength: 0.65,
        sensitivity: 1.2
      };
    } else if (confidence < 0.6) {
      // Confianza media: ajustes moderados
      this.suggestedParameters = {
        amplification: 1.3,
        filterStrength: 0.6,
        sensitivity: 1.1
      };
    } else {
      // Alta confianza: no sugerir cambios
      this.suggestedParameters = {};
    }
  }
  
  /**
   * Obtiene el parámetro preferido para ajuste
   */
  protected getPreferredParameter(): string {
    return "amplification";
  }

  /**
   * Calcula consistencia de tendencia
   */
  private calculateTrendConsistency(): number {
    return 0.8;
  }
  
  /**
   * Reinicia calculador
   */
  protected resetSpecific(): void {
    this.decayTime = 0;
    this.peakAmplitude = 0;
    this.areaUnderCurve = 0;
    this.trendData = [];
  }
}
