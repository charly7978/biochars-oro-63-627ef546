
import { ProcessorConfig } from '../config/ProcessorConfig';
import { VitalSignsConfig } from '../config/VitalSignsConfig';

export interface LipidResult {
  totalCholesterol: number;
  triglycerides: number;
}

/**
 * Estimador de lípidos basado en características del pulso
 */
export class LipidEstimator {
  private confidence: number = 0;
  private lipidCalibrationFactor: number = 1.0;
  
  constructor(private config: ProcessorConfig = {
    glucoseCalibrationFactor: 1.0,
    lipidCalibrationFactor: 1.0,
    hemoglobinCalibrationFactor: 1.0,
    confidenceThreshold: 0.6,
    cholesterolCalibrationFactor: 1.0,
    triglycerideCalibrationFactor: 1.0
  }) {
    this.lipidCalibrationFactor = config.lipidCalibrationFactor || 1.0;
  }
  
  /**
   * Estima niveles de lípidos basados en características del pulso
   */
  public estimate(ppgValues: number[]): LipidResult {
    if (ppgValues.length < 80) {
      return {
        totalCholesterol: 0,
        triglycerides: 0
      };
    }
    
    // Calcular índices de señal
    const filteredValues = this.applyFilter(ppgValues);
    const peaks = this.detectPeaks(filteredValues);
    const peakToPeakIntervals = this.calculatePeakIntervals(peaks);
    
    // Características clave para predicción
    const amplitude = this.calculateAmplitude(filteredValues);
    const pulseWidth = this.calculatePulseWidth(filteredValues, peaks);
    const decay = this.calculateDecayRate(filteredValues, peaks);
    
    // Algoritmo simplificado para estimación a partir de características
    // En un sistema real, esto utilizaría modelos de aprendizaje profundo
    
    // Niveles base saludables
    const baseCholesterol = 180; // mg/dL
    const baseTriglycerides = 150; // mg/dL
    
    // Ajustar en función de características de la señal
    const cholesterolFactor = 1 + (amplitude * 0.1) + (pulseWidth * 0.05) - (decay * 0.1);
    const triglycerideFactor = 1 + (amplitude * 0.08) + (pulseWidth * 0.1) - (decay * 0.05);
    
    // Aplicar factores de calibración del dispositivo
    const cholesterolCalibrationFactor = this.config.cholesterolCalibrationFactor || 1.0;
    const triglycerideCalibrationFactor = this.config.triglycerideCalibrationFactor || 1.0;
    
    const cholesterol = Math.round(baseCholesterol * cholesterolFactor * cholesterolCalibrationFactor);
    const triglycerides = Math.round(baseTriglycerides * triglycerideFactor * triglycerideCalibrationFactor);
    
    // Limitar a rangos fisiológicos
    const finalCholesterol = this.constrainValue(cholesterol, 120, 300);
    const finalTriglycerides = this.constrainValue(triglycerides, 50, 500);
    
    // Calcular confianza basada en calidad de señal
    this.confidence = this.calculateConfidence(filteredValues, peaks);
    
    return {
      totalCholesterol: finalCholesterol,
      triglycerides: finalTriglycerides
    };
  }
  
  /**
   * Retorna nivel de confianza de la última estimación
   */
  public getConfidence(): number {
    return this.confidence;
  }
  
  /**
   * Reinicia el estado del estimador
   */
  public reset(): void {
    this.confidence = 0;
  }
  
  /**
   * Calcula amplitud de la señal
   */
  private calculateAmplitude(values: number[]): number {
    const recentValues = values.slice(-30);
    return Math.max(...recentValues) - Math.min(...recentValues);
  }
  
  /**
   * Calcula ancho de pulso promedio
   */
  private calculatePulseWidth(values: number[], peaks: number[]): number {
    if (peaks.length < 2) return 0.2; // Valor por defecto
    
    let totalWidth = 0;
    let widthCount = 0;
    
    for (let i = 0; i < peaks.length; i++) {
      const peakIndex = peaks[i];
      let leftEdge = peakIndex;
      let rightEdge = peakIndex;
      
      const peakValue = values[peakIndex];
      const halfHeight = peakValue / 2;
      
      // Encontrar borde izquierdo
      while (leftEdge > 0 && values[leftEdge] > halfHeight) {
        leftEdge--;
      }
      
      // Encontrar borde derecho
      while (rightEdge < values.length - 1 && values[rightEdge] > halfHeight) {
        rightEdge++;
      }
      
      const width = rightEdge - leftEdge;
      if (width > 0) {
        totalWidth += width;
        widthCount++;
      }
    }
    
    const averageWidth = widthCount > 0 ? totalWidth / widthCount : 0.2;
    
    // Normalizar a un valor entre 0-1
    return Math.min(1, averageWidth / 30);
  }
  
  /**
   * Calcula tasa de decaimiento después de picos
   */
  private calculateDecayRate(values: number[], peaks: number[]): number {
    if (peaks.length < 2) return 0.5; // Valor por defecto
    
    let totalDecay = 0;
    let decayCount = 0;
    
    for (let i = 0; i < peaks.length - 1; i++) {
      const peakIndex = peaks[i];
      const nextPeakIndex = peaks[i+1];
      
      if (nextPeakIndex - peakIndex < 5) continue; // Demasiado cerca
      
      const peakValue = values[peakIndex];
      const midPoint = Math.floor((peakIndex + nextPeakIndex) / 2);
      
      if (midPoint > peakIndex) {
        const midValue = values[midPoint];
        const decay = (peakValue - midValue) / peakValue;
        
        totalDecay += decay;
        decayCount++;
      }
    }
    
    return decayCount > 0 ? totalDecay / decayCount : 0.5;
  }
  
  /**
   * Detecta picos en la señal
   */
  private detectPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > values[i-1] && 
          values[i] > values[i-2] &&
          values[i] > values[i+1] && 
          values[i] > values[i+2]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Calcula intervalos entre picos
   */
  private calculatePeakIntervals(peaks: number[]): number[] {
    const intervals: number[] = [];
    
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    return intervals;
  }
  
  /**
   * Aplica filtro simple para reducir ruido
   */
  private applyFilter(values: number[]): number[] {
    const filtered: number[] = [];
    const windowSize = 3;
    
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(values.length - 1, i + windowSize); j++) {
        sum += values[j];
        count++;
      }
      
      filtered.push(sum / count);
    }
    
    return filtered;
  }
  
  /**
   * Calcula confianza basada en calidad de señal
   */
  private calculateConfidence(values: number[], peaks: number[]): number {
    if (values.length < 60 || peaks.length < 2) {
      return 0.1;
    }
    
    // Calcular regularidad de picos
    const intervals = this.calculatePeakIntervals(peaks);
    
    if (intervals.length < 2) {
      return 0.2;
    }
    
    // Calcular variabilidad de intervalos (menor CV = mayor confianza)
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 1;
    
    // Confianza basada en regularidad
    let confidenceFromRegularity = 1 - Math.min(1, cv);
    
    // Confianza basada en amplitud
    const amplitude = this.calculateAmplitude(values);
    const confidenceFromAmplitude = Math.min(1, amplitude / 0.5);
    
    // Confianza ponderada
    const confidence = (confidenceFromRegularity * 0.7) + (confidenceFromAmplitude * 0.3);
    
    return Math.max(0.1, Math.min(0.9, confidence));
  }
  
  /**
   * Limita valor a rango específico
   */
  private constrainValue(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
