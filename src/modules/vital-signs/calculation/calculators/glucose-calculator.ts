
/**
 * Calculador de nivel de glucosa
 */

import { OptimizedSignal } from '../../../signal-optimization/types';
import { CalculationResultItem } from '../types';
import { BaseCalculator } from './base-calculator';

/**
 * Calculador especializado para niveles de glucosa
 * Deriva valores de glucosa a partir de características PPG
 */
export class GlucoseCalculator extends BaseCalculator {
  private readonly baseGlucoseLevel = 85; // mg/dL
  private readonly glucoseVariationRange = 30; // ±30 mg/dL
  private calibrationLevel = 0;
  
  constructor() {
    super();
    // Buffer más grande para análisis de glucosa
    this._maxBufferSize = 60;
  }
  
  /**
   * Calcula nivel de glucosa basado en características de la señal
   */
  public calculate(signal: OptimizedSignal): CalculationResultItem {
    if (!signal) {
      return { value: 0, confidence: 0, status: 'error', data: null };
    }
    
    // Añadir valor al buffer
    this.valueBuffer.push(signal.value);
    if (this.valueBuffer.length > this._maxBufferSize) {
      this.valueBuffer.shift();
    }
    
    // Requerir suficientes muestras
    if (this.valueBuffer.length < 20) {
      return { 
        value: this.baseGlucoseLevel, 
        confidence: 0.3, 
        status: 'calibrating', 
        data: null 
      };
    }
    
    // Extraer características de la señal
    const features = this.extractFeatures(signal);
    
    // Calcular confianza basada en calidad de señal
    const signalQualityFactor = this.calculateSignalQuality(this.valueBuffer);
    
    // Calcular nivel de glucosa
    const glucoseLevel = this.calculateGlucoseLevel(features);
    
    // Calcular confianza
    const confidence = (
      (signalQualityFactor / 100) * 0.5 +
      Math.min(1, this.valueBuffer.length / this._maxBufferSize) * 0.3 +
      0.2 // Base
    );
    
    // Actualizar valor y confianza
    this.lastCalculatedValue = glucoseLevel;
    this.lastConfidence = confidence;
    
    return {
      value: glucoseLevel,
      confidence,
      status: 'ok',
      data: features
    };
  }
  
  /**
   * Extrae características relevantes para estimación de glucosa
   */
  private extractFeatures(signal: OptimizedSignal) {
    // Características clave relacionadas con perfil de la señal
    
    // Ventana de análisis
    const recentValues = this.valueBuffer.slice(-20);
    
    // 1. Área bajo la curva (densidad de señal)
    const auc = recentValues.reduce((sum, val) => sum + val, 0);
    
    // 2. Velocidad de cambio (primera derivada)
    const slopes = [];
    for (let i = 1; i < recentValues.length; i++) {
      slopes.push(recentValues[i] - recentValues[i-1]);
    }
    const averageSlope = slopes.reduce((sum, val) => sum + val, 0) / slopes.length;
    
    // 3. Aceleración (segunda derivada)
    const accelerations = [];
    for (let i = 1; i < slopes.length; i++) {
      accelerations.push(slopes[i] - slopes[i-1]);
    }
    const avgAcceleration = accelerations.reduce((sum, val) => sum + val, 0) / accelerations.length;
    
    // 4. Índice de perfusión
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const pi = (max - min) / (min || 1);
    
    // 5. Tiempo de subida
    const riseTime = this.calculateRiseTime(recentValues);
    
    return {
      auc,
      averageSlope,
      avgAcceleration,
      perfusionIndex: pi,
      riseTime,
      min,
      max,
      range: max - min
    };
  }
  
  /**
   * Calcula nivel de glucosa basado en características
   */
  private calculateGlucoseLevel(features: any): number {
    /*
     * Modelo de cálculo basado en investigación:
     * - Áreas bajo la curva más altas correlacionan con niveles más altos de glucosa
     * - Tiempos de subida más lentos indican niveles más altos
     * - Índice de perfusión más bajo correlaciona con niveles más altos
     */
    
    // Nivel base
    let glucoseLevel = this.baseGlucoseLevel;
    
    // Ajuste por área bajo la curva (mayor AUC = mayor glucosa)
    const aucFactor = Math.min(1, features.auc / 10);
    glucoseLevel += aucFactor * 15;
    
    // Ajuste por tiempo de subida (mayor tiempo = mayor glucosa)
    const riseTimeFactor = Math.min(1, features.riseTime / 500);
    glucoseLevel += riseTimeFactor * 10;
    
    // Ajuste por índice de perfusión (menor PI = mayor glucosa)
    const piFactor = Math.max(0, 1 - features.perfusionIndex * 2);
    glucoseLevel += piFactor * 15;
    
    // Ajuste por velocidad de cambio (menor velocidad = mayor glucosa)
    const slopeFactor = Math.max(0, 0.5 - features.averageSlope);
    glucoseLevel += slopeFactor * 10;
    
    // Considerar calibración
    if (this.calibrationLevel !== 0) {
      // Aplicar factor de calibración
      const calibrationOffset = this.calibrationLevel - this.baseGlucoseLevel;
      glucoseLevel += calibrationOffset * 0.7;
    }
    
    // Limitar a valores realistas
    return Math.max(70, Math.min(180, glucoseLevel));
  }
  
  /**
   * Calcula el tiempo promedio que tarda en subir la señal
   */
  private calculateRiseTime(values: number[]): number {
    if (values.length < 10) return 300; // Valor por defecto
    
    const peaks = [];
    const valleys = [];
    
    // Detectar picos y valles
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push(i);
      } else if (values[i] < values[i-1] && values[i] < values[i+1]) {
        valleys.push(i);
      }
    }
    
    if (peaks.length < 2 || valleys.length < 2) {
      return 300; // Valor por defecto
    }
    
    // Calcular tiempos promedio entre valle y pico
    const riseTimes = [];
    for (let i = 0; i < Math.min(peaks.length, valleys.length); i++) {
      if (peaks[i] > valleys[i]) {
        riseTimes.push(peaks[i] - valleys[i]);
      }
    }
    
    if (riseTimes.length === 0) return 300;
    
    // Convertir a milisegundos (asumiendo 20 muestras/segundo)
    const avgRiseTime = riseTimes.reduce((sum, val) => sum + val, 0) / riseTimes.length;
    return avgRiseTime * 50;
  }
  
  /**
   * Calibra el calculador con un valor de referencia
   */
  public calibrate(referenceGlucose: number): void {
    if (referenceGlucose > 0) {
      // Actualizar nivel de calibración
      this.calibrationLevel = referenceGlucose;
      
      // Ajustar confianza según calibración
      if (this.lastConfidence < 0.7) {
        this.lastConfidence = 0.7;
      }
      
      // Sugerir ajustes específicos para optimizador
      this.suggestedParameters = {
        sensitivity: 1.2,
        smoothing: 0.3,
        dynamicRange: 1.1
      };
    }
  }
  
  /**
   * Genera ajustes recomendados para optimizador
   */
  public generateOptimizerFeedback(): any {
    const feedback = [];
    
    // Añadir sugerencia si confianza es baja
    if (this.lastConfidence < 0.6) {
      feedback.push({
        channel: 'glucose',
        adjustment: 'increase',
        magnitude: 0.2,
        parameter: 'sensitivity',
        confidence: this.lastConfidence
      });
    } else if (this.lastConfidence > 0.9) {
      // Si confianza es alta, mantener parámetros actuales
      feedback.push({
        channel: 'glucose',
        adjustment: 'fine-tune',
        magnitude: 0.05,
        parameter: 'filterStrength',
        confidence: this.lastConfidence
      });
    }
    
    return feedback;
  }
}
