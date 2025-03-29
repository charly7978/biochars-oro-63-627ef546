
/**
 * Optimizador especializado para frecuencia cardíaca
 * Aplica algoritmos específicos para mejorar la detección de picos y latidos cardíacos
 */

import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { ProcessedPPGSignal } from '../../signal-processing/types';
import { OptimizedSignal, FeedbackData, OptimizationParameters } from '../types';

export class HeartRateOptimizer extends BaseChannelOptimizer {
  private lastValues: number[] = [];
  private readonly maxValues = 50;
  private peakThreshold = 0.3;
  private readonly minPeakDistance = 300; // ms
  private lastPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private readonly maxIntervals = 10;
  
  constructor(config: Partial<OptimizationParameters> = {}) {
    super('heartRate', {
      amplificationFactor: 1.5,
      filteringLevel: 'medium',
      ...config
    });
  }
  
  /**
   * Optimiza señal para frecuencia cardíaca
   */
  public optimize(signal: ProcessedPPGSignal): OptimizedSignal {
    // Añadir al buffer interno
    this.addToBuffer(signal);
    
    // Extraer valores
    const value = signal.filteredValue || signal.rawValue;
    
    // Añadir a valores recientes
    this.lastValues.push(value);
    if (this.lastValues.length > this.maxValues) {
      this.lastValues.shift();
    }
    
    // Aplicar filtrado adaptativo para suavizar
    const filteredValues = this.applyAdaptiveFiltering([...this.lastValues]);
    
    // Detectar pico
    const { isPeak, interval } = this.detectPeak(filteredValues, signal.timestamp);
    
    // Actualizar intervalos RR si se detectó un pico
    if (isPeak && interval && interval > 0) {
      this.rrIntervals.push(interval);
      if (this.rrIntervals.length > this.maxIntervals) {
        this.rrIntervals.shift();
      }
    }
    
    // Calcular confianza basada en estabilidad de intervalos
    const confidence = this.calculateConfidence();
    
    // Amplificar valor final
    const amplifiedValue = this.amplifySignal(filteredValues[filteredValues.length - 1]);
    
    return {
      channel: this.channelId,
      value: amplifiedValue,
      timestamp: signal.timestamp,
      confidence,
      metadata: {
        peaks: isPeak,
        intervals: [...this.rrIntervals],
        lastPeakTime: this.lastPeakTime,
        filteredValues: filteredValues.slice(-5)
      }
    };
  }
  
  /**
   * Procesa retroalimentación desde el calculador de frecuencia cardíaca
   */
  public processFeedback(feedback: FeedbackData): void {
    // Adaptar configuración según feedback
    if (feedback.parameter === 'peakThreshold') {
      if (feedback.adjustment === 'increase') {
        this.peakThreshold = Math.min(0.6, this.peakThreshold + feedback.magnitude * 0.2);
      } else if (feedback.adjustment === 'decrease') {
        this.peakThreshold = Math.max(0.1, this.peakThreshold - feedback.magnitude * 0.1);
      }
    } else if (feedback.parameter === 'amplificationFactor') {
      if (feedback.adjustment === 'increase') {
        this.parameters.amplificationFactor = Math.min(3.0, this.parameters.amplificationFactor * (1 + feedback.magnitude * 0.5));
      } else if (feedback.adjustment === 'decrease') {
        this.parameters.amplificationFactor = Math.max(0.5, this.parameters.amplificationFactor * (1 - feedback.magnitude * 0.3));
      } else if (feedback.adjustment === 'reset') {
        this.parameters.amplificationFactor = 1.5;
      }
    }
    
    // Adaptación general de parámetros
    this.adaptToFeedback(feedback);
  }
  
  /**
   * Detecta picos en la señal filtrada
   */
  private detectPeak(values: number[], timestamp: number): { isPeak: boolean, interval: number | null } {
    if (values.length < 3) {
      return { isPeak: false, interval: null };
    }
    
    const lastIdx = values.length - 1;
    
    // Verificar si es un máximo local
    const isPotentialPeak = values[lastIdx - 1] > values[lastIdx - 2] && 
                           values[lastIdx - 1] > values[lastIdx] &&
                           values[lastIdx - 1] > this.peakThreshold;
                           
    // Verificar distancia mínima desde último pico
    const isValidTiming = this.lastPeakTime === null || 
                          (timestamp - this.lastPeakTime) > this.minPeakDistance;
    
    const isPeak = isPotentialPeak && isValidTiming;
    
    let interval: number | null = null;
    
    if (isPeak) {
      // Calcular intervalo
      if (this.lastPeakTime !== null) {
        interval = timestamp - this.lastPeakTime;
      }
      
      // Actualizar último tiempo de pico
      this.lastPeakTime = timestamp;
    }
    
    return { isPeak, interval };
  }
  
  /**
   * Calcula confianza basada en estabilidad de intervalos RR
   */
  private calculateConfidence(): number {
    if (this.rrIntervals.length < 3) {
      return 0.3;
    }
    
    // Calcular desviación estándar de intervalos
    const avg = this.rrIntervals.reduce((a, b) => a + b, 0) / this.rrIntervals.length;
    const variance = this.rrIntervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / this.rrIntervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Menor desviación = mayor confianza (normalizada)
    const normalizedStdDev = Math.min(1, stdDev / avg);
    const stabilityConfidence = 1 - normalizedStdDev;
    
    // Incluir número de intervalos en confianza
    const countConfidence = Math.min(1, this.rrIntervals.length / this.maxIntervals);
    
    // Confianza combinada (ponderada)
    return 0.7 * stabilityConfidence + 0.3 * countConfidence;
  }
  
  /**
   * Reinicia el optimizador
   */
  public reset(): void {
    super.reset();
    this.lastValues = [];
    this.lastPeakTime = null;
    this.rrIntervals = [];
  }
}
