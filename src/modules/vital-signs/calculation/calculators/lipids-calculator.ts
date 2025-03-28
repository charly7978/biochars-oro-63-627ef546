/**
 * Calculador de lípidos sanguíneos
 */

import { OptimizedSignal } from '../../../signal-optimization/types';
import { CalculationResultItem } from '../types';
import { BaseCalculator } from './base-calculator';

/**
 * Calculador especializado para niveles de lípidos
 * Estima colesterol total y triglicéridos basado en características PPG
 */
export class LipidsCalculator extends BaseCalculator {
  private readonly lipidType: 'cholesterol' | 'triglycerides';
  private readonly baseCholesterol = 170; // mg/dL
  private readonly baseTriglycerides = 120; // mg/dL
  private readonly lipidVariationRange = 40; // ±40 mg/dL
  private calibrationCholesterol = 0;
  private calibrationTriglycerides = 0;
  private lastPulseShape: number[] = [];
  private lastCholesterolValue = 0;
  private lastTriglyceridesValue = 0;
  
  constructor(lipidType: 'cholesterol' | 'triglycerides') {
    super();
    this.lipidType = lipidType;
    // Buffer más grande para análisis
    this._maxBufferSize = 100;
  }
  
  /**
   * Calcula niveles de lípidos basado en características de la señal
   */
  public calculate(signal: OptimizedSignal): CalculationResultItem<number> {
    if (!signal) {
      return { value: 0, confidence: 0, status: 'error', data: null };
    }
    
    // Añadir valor al buffer
    this.valueBuffer.push(signal.value);
    if (this.valueBuffer.length > this._maxBufferSize) {
      this.valueBuffer.shift();
    }
    
    // Requerir suficientes muestras
    if (this.valueBuffer.length < 50) {
      // Determinar valor base según tipo de lípido
      const baseValue = this.lipidType === 'cholesterol' ? this.baseCholesterol : this.baseTriglycerides;
      
      return { 
        value: baseValue,
        confidence: 0.3, 
        status: 'calibrating', 
        data: null 
      };
    }
    
    // Extraer características de la señal
    const features = this.extractFeatures(signal);
    
    // Calcular confianza basada en calidad de señal
    const signalQuality = this.calculateSignalQuality(this.valueBuffer);
    
    // Calcular niveles de lípidos
    const { cholesterol, triglycerides } = this.calculateLipidLevels(features);
    
    // Determinar valor según tipo de lípido
    const value = this.lipidType === 'cholesterol' ? cholesterol : triglycerides;
    
    // Actualizar valores
    this.lastCholesterolValue = cholesterol;
    this.lastTriglyceridesValue = triglycerides;
    
    // Calcular confianza
    const confidence = (
      (signalQuality / 100) * 0.4 +
      Math.min(1, this.valueBuffer.length / this._maxBufferSize) * 0.3 +
      0.2 // Base
    );
    
    // Actualizar confianza
    this.lastConfidence = confidence;
    
    return {
      value,
      confidence,
      status: 'ok',
      data: features
    };
  }
  
  /**
   * Extrae características relevantes para estimación de lípidos
   */
  private extractFeatures(signal: OptimizedSignal) {
    // Características clave relacionadas con perfil de la señal
    
    // Ventana de análisis
    const recentValues = this.valueBuffer.slice(-60);
    
    // Detectar picos y valles
    const { peaks, valleys } = this.detectPeaksAndValleys(recentValues);
    
    // Capturar forma de pulso
    this.capturePulseShape(recentValues, peaks, valleys);
    
    // 1. Relación pico-valle (amplitud)
    const amplitudes = [];
    for (let i = 0; i < Math.min(peaks.length, valleys.length); i++) {
      if (peaks[i] > valleys[i]) {
        amplitudes.push(recentValues[peaks[i]] - recentValues[valleys[i]]);
      }
    }
    const avgAmplitude = amplitudes.length > 0 ? 
      amplitudes.reduce((sum, val) => sum + val, 0) / amplitudes.length : 0;
    
    // 2. Área bajo la curva (AUC)
    const auc = recentValues.reduce((sum, val) => sum + val, 0);
    
    // 3. Características del contorno de onda
    const contourFeatures = this.extractContourFeatures(recentValues, peaks, valleys);
    
    // 4. Velocidad de propagación
    const propagationSpeed = this.calculatePropagationSpeed(recentValues, peaks);
    
    // 5. Distorsión armónica
    const harmonicDistortion = this.calculateHarmonicDistortion(recentValues);
    
    return {
      avgAmplitude,
      auc,
      ...contourFeatures,
      propagationSpeed,
      harmonicDistortion,
      peakCount: peaks.length,
      valleyCount: valleys.length
    };
  }
  
  /**
   * Detecta picos y valles en una señal
   */
  private detectPeaksAndValleys(values: number[]) {
    const peaks = [];
    const valleys = [];
    
    for (let i = 2; i < values.length - 2; i++) {
      // Detección de picos (5-punto)
      if (values[i] > values[i-2] && values[i] > values[i-1] && 
          values[i] > values[i+1] && values[i] > values[i+2]) {
        peaks.push(i);
      }
      
      // Detección de valles (5-punto)
      if (values[i] < values[i-2] && values[i] < values[i-1] && 
          values[i] < values[i+1] && values[i] < values[i+2]) {
        valleys.push(i);
      }
    }
    
    return { peaks, valleys };
  }
  
  /**
   * Captura forma de pulso representativa
   */
  private capturePulseShape(values: number[], peaks: number[], valleys: number[]): void {
    if (peaks.length < 2 || valleys.length < 1) return;
    
    // Encontrar un pulso completo (valle - pico - valle)
    let pulseStart = -1;
    let pulseEnd = -1;
    
    for (let i = 0; i < valleys.length - 1; i++) {
      // Buscar un pico entre dos valles
      const valley1 = valleys[i];
      const valley2 = valleys[i+1];
      let hasPeak = false;
      
      for (const peak of peaks) {
        if (peak > valley1 && peak < valley2) {
          hasPeak = true;
          break;
        }
      }
      
      if (hasPeak) {
        pulseStart = valley1;
        pulseEnd = valley2;
        break;
      }
    }
    
    if (pulseStart >= 0 && pulseEnd > pulseStart) {
      // Capturar forma de pulso
      this.lastPulseShape = values.slice(pulseStart, pulseEnd + 1);
      
      // Normalizar
      const min = Math.min(...this.lastPulseShape);
      const max = Math.max(...this.lastPulseShape);
      if (max > min) {
        this.lastPulseShape = this.lastPulseShape.map(v => (v - min) / (max - min));
      }
    }
  }
  
  /**
   * Extrae características del contorno de la onda
   */
  private extractContourFeatures(values: number[], peaks: number[], valleys: number[]) {
    // Propiedades del contorno relevantes para lípidos:
    
    // 1. Tiempo desde valle a pico (rise time)
    const riseTimes = [];
    
    for (let i = 0; i < valleys.length; i++) {
      const valley = valleys[i];
      let nextPeak = -1;
      
      for (const peak of peaks) {
        if (peak > valley) {
          nextPeak = peak;
          break;
        }
      }
      
      if (nextPeak > 0) {
        riseTimes.push(nextPeak - valley);
      }
    }
    
    const avgRiseTime = riseTimes.length > 0 ? 
      riseTimes.reduce((sum, val) => sum + val, 0) / riseTimes.length : 0;
    
    // 2. Tiempo desde pico a valle (fall time)
    const fallTimes = [];
    
    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      let nextValley = -1;
      
      for (const valley of valleys) {
        if (valley > peak) {
          nextValley = valley;
          break;
        }
      }
      
      if (nextValley > 0) {
        fallTimes.push(nextValley - peak);
      }
    }
    
    const avgFallTime = fallTimes.length > 0 ? 
      fallTimes.reduce((sum, val) => sum + val, 0) / fallTimes.length : 0;
    
    // 3. Muesca dicrótica: posición relativa y profundidad
    let dicroticNotchPos = 0;
    let dicroticNotchDepth = 0;
    
    for (const peak of peaks) {
      if (peak + 2 >= values.length) continue;
      
      let notchPos = -1;
      let notchDepth = 0;
      
      for (let i = peak + 2; i < Math.min(values.length - 1, peak + 20); i++) {
        const slope1 = values[i] - values[i-1];
        const slope2 = values[i+1] - values[i];
        
        if (slope1 < 0 && slope2 > 0) {
          notchPos = i;
          notchDepth = values[peak] - values[i];
          break;
        }
      }
      
      if (notchPos > 0) {
        dicroticNotchPos += notchPos - peak;
        dicroticNotchDepth += notchDepth;
      }
    }
    
    if (peaks.length > 0) {
      dicroticNotchPos /= peaks.length;
      dicroticNotchDepth /= peaks.length;
    }
    
    // 4. Rigidez arterial (stiffness)
    const pulseWidths = [];
    for (let i = 0; i < Math.min(peaks.length - 1, valleys.length - 1); i++) {
      pulseWidths.push(peaks[i+1] - peaks[i]);
    }
    
    const avgPulseWidth = pulseWidths.length > 0 ? 
      pulseWidths.reduce((sum, val) => sum + val, 0) / pulseWidths.length : 0;
    
    return {
      avgRiseTime,
      avgFallTime,
      dicroticNotchPos,
      dicroticNotchDepth,
      avgPulseWidth
    };
  }
  
  /**
   * Calcula velocidad de propagación de la onda de pulso
   */
  private calculatePropagationSpeed(values: number[], peaks: number[]): number {
    if (peaks.length < 2) return 0;
    
    // Estimación simplificada: distancia entre picos
    const peakIntervals = [];
    for (let i = 0; i < peaks.length - 1; i++) {
      peakIntervals.push(peaks[i+1] - peaks[i]);
    }
    
    return peakIntervals.reduce((sum, val) => sum + val, 0) / peakIntervals.length;
  }
  
  /**
   * Calcula distorsión armónica (relacionada con viscosidad sanguínea)
   */
  private calculateHarmonicDistortion(values: number[]): number {
    if (values.length < 20) return 0;
    
    // Estimación simplificada: variabilidad en la forma de onda
    const diffs = [];
    for (let i = 1; i < values.length; i++) {
      diffs.push(Math.abs(values[i] - values[i-1]));
    }
    
    const avgDiff = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    const varDiff = diffs.reduce((sum, val) => sum + Math.pow(val - avgDiff, 2), 0) / diffs.length;
    
    return Math.sqrt(varDiff);
  }
  
  /**
   * Calcula niveles de lípidos basado en características
   */
  private calculateLipidLevels(features: any): { cholesterol: number, triglycerides: number } {
    /*
     * Modelo de cálculo basado en investigación:
     * - Mayor tiempo de caída correlaciona con colesterol más alto
     * - Menor amplitud correlaciona con colesterol alto
     * - Mayor distorsión armónica correlaciona con triglicéridos altos
     * - Menor velocidad de propagación correlaciona con niveles más altos
     */
    
    // Valores iniciales
    let cholesterol = this.baseCholesterol;
    let triglycerides = this.baseTriglycerides;
    
    // 1. Ajuste por tiempo de caída (directo para colesterol)
    const fallTimeNorm = Math.min(1, features.avgFallTime / 20);
    cholesterol += fallTimeNorm * 25;
    
    // 2. Ajuste por amplitud (inverso para colesterol)
    const amplitudeNorm = Math.min(1, features.avgAmplitude * 3);
    cholesterol += (1 - amplitudeNorm) * 20;
    
    // 3. Ajuste por distorsión armónica (directo para triglicéridos)
    const distortionNorm = Math.min(1, features.harmonicDistortion * 10);
    triglycerides += distortionNorm * 30;
    
    // 4. Ajuste por velocidad de propagación (inverso para ambos)
    const speedNorm = Math.min(1, features.propagationSpeed / 20);
    cholesterol += (1 - speedNorm) * 15;
    triglycerides += (1 - speedNorm) * 25;
    
    // 5. Ajuste por posición de muesca dicrótica (inverso para colesterol)
    const notchPosNorm = Math.min(1, features.dicroticNotchPos / 15);
    cholesterol += (1 - notchPosNorm) * 15;
    
    // 6. Ajuste por profundidad de muesca (inverso para triglicéridos)
    const notchDepthNorm = Math.min(1, features.dicroticNotchDepth * 5);
    triglycerides += (1 - notchDepthNorm) * 20;
    
    // Considerar calibración
    if (this.calibrationCholesterol > 0) {
      const cholDiff = this.calibrationCholesterol - this.baseCholesterol;
      cholesterol += cholDiff * 0.7;
    }
    
    if (this.calibrationTriglycerides > 0) {
      const trigDiff = this.calibrationTriglycerides - this.baseTriglycerides;
      triglycerides += trigDiff * 0.7;
    }
    
    // Limitar a valores realistas
    cholesterol = Math.max(120, Math.min(280, Math.round(cholesterol)));
    triglycerides = Math.max(70, Math.min(300, Math.round(triglycerides)));
    
    return { cholesterol, triglycerides };
  }
  
  /**
   * Calibra el calculador con valores de referencia
   */
  public calibrate(reference: { cholesterol?: number, triglycerides?: number }): void {
    if (reference) {
      if (reference.cholesterol && reference.cholesterol > 0) {
        this.calibrationCholesterol = reference.cholesterol;
      }
      
      if (reference.triglycerides && reference.triglycerides > 0) {
        this.calibrationTriglycerides = reference.triglycerides;
      }
      
      // Ajustar confianza según calibración
      if (this.lastConfidence < 0.7) {
        this.lastConfidence = 0.7;
      }
      
      // Sugerir ajustes específicos para optimizador
      if (reference.cholesterol && reference.cholesterol > 220) {
        // Colesterol alto
        this.suggestedParameters = {
          amplification: 1.2,
          filterStrength: 0.45
        };
      } else if (reference.triglycerides && reference.triglycerides > 180) {
        // Triglicéridos altos
        this.suggestedParameters = {
          sensitivity: 1.3,
          filterStrength: 0.4
        };
      } else {
        // Lípidos normales
        this.suggestedParameters = {
          sensitivity: 1.2,
          filterStrength: 0.35
        };
      }
    }
  }
  
  /**
   * Genera ajustes recomendados para optimizador
   */
  public generateOptimizerFeedback(): any {
    const feedback = [];
    
    // Retroalimentación para colesterol
    if (this.lastCholesterolValue > 220) {
      feedback.push({
        channel: 'cholesterol',
        adjustment: 'increase',
        magnitude: 0.15,
        parameter: 'filterStrength'
      });
      
      feedback.push({
        channel: 'cholesterol',
        adjustment: 'decrease',
        magnitude: 0.1,
        parameter: 'sensitivity'
      });
    }
    
    // Retroalimentación para triglicéridos
    if (this.lastTriglyceridesValue > 180) {
      feedback.push({
        channel: 'triglycerides',
        adjustment: 'increase',
        magnitude: 0.1,
        parameter: 'dynamicRange'
      });
    }
    
    return feedback;
  }
}
