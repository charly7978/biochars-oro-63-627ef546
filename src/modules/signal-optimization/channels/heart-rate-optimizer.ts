
/**
 * Optimizador de canal para frecuencia cardíaca
 * Implementa técnicas avanzadas específicas para optimizar señales de frecuencia cardíaca
 */

import { ProcessedPPGSignal } from '../../signal-processing/types';
import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { OptimizedSignal, FeedbackData, ChannelOptimizerConfig } from '../types';

export class HeartRateOptimizer extends BaseChannelOptimizer {
  private readonly peakEnhancementFactor: number = 1.5;
  private readonly smoothingFactor: number = 0.4;
  private feedbackCounter: number = 0;
  private adaptiveThreshold: number = 0.2;
  
  constructor(config: ChannelOptimizerConfig = {}) {
    super('heartRate', config);
  }
  
  /**
   * Optimiza una señal PPG específicamente para análisis de frecuencia cardíaca
   */
  public optimizeSignal(signal: ProcessedPPGSignal): OptimizedSignal | null {
    if (!signal || !signal.fingerDetected) {
      return null;
    }
    
    // Añadir al buffer para contexto histórico
    this.addToBuffer(signal);
    
    // Extraer valores filtrados del buffer para optimización
    const filteredValues = this.signalBuffer
      .slice(-20)
      .map(s => s.filteredValue);
    
    // Aplicar algoritmos de avanzada para optimización de frecuencia cardíaca
    const optimizedValues = this.applyHeartRateOptimization(filteredValues);
    
    // Extraer RR intervals si están disponibles
    const rrIntervals = signal.rrIntervals || [];
    
    return {
      channelId: this.channelId,
      timestamp: signal.timestamp,
      value: optimizedValues[optimizedValues.length - 1] || signal.filteredValue,
      quality: this.calculateSignalQuality(signal),
      confidence: this.calculateConfidence(signal),
      metadata: {
        rrIntervals: rrIntervals,
        lastPeakTime: signal.lastPeakTime,
        isPeak: signal.isPeak
      }
    };
  }
  
  /**
   * Procesa retroalimentación desde calculador de frecuencia cardíaca
   */
  public processFeedback(feedback: FeedbackData): void {
    if (!feedback || !feedback.adjustment) return;
    
    this.feedbackCounter++;
    
    // Ajustar parámetros basados en la retroalimentación
    if (feedback.adjustment.type === 'sensitivity') {
      // Ajustar umbral adaptativo
      this.adaptiveThreshold = Math.max(
        0.05, 
        Math.min(0.5, this.adaptiveThreshold + feedback.adjustment.value)
      );
    }
    
    if (feedback.adjustment.type === 'amplification') {
      // Ajustar factor de amplificación
      this.config.amplificationFactor = Math.max(
        0.5,
        Math.min(3.0, (this.config.amplificationFactor || 1.0) + feedback.adjustment.value)
      );
    }
    
    // Registrar feedback para depuración
    console.log(`HeartRateOptimizer: Processed feedback #${this.feedbackCounter}`, {
      newThreshold: this.adaptiveThreshold,
      newAmplification: this.config.amplificationFactor,
      feedbackType: feedback.adjustment.type
    });
  }
  
  /**
   * Aplica algoritmos avanzados de optimización para frecuencia cardíaca
   */
  private applyHeartRateOptimization(values: number[]): number[] {
    if (values.length < 2) return values;
    
    // Paso 1: Aumentar prominencia de picos
    const peakEnhanced = this.enhancePeaks(values);
    
    // Paso 2: Aplicar filtrado adaptativo
    const filtered = this.applyAdaptiveFiltering(peakEnhanced);
    
    // Paso 3: Amplificar señal para mejor detección
    const amplified = filtered.map(v => this.amplifySignal(v));
    
    return amplified;
  }
  
  /**
   * Aumenta la prominencia de los picos en la señal
   * Algoritmo avanzado para resaltar características cardíacas
   */
  private enhancePeaks(values: number[]): number[] {
    if (values.length < 3) return values;
    
    const result: number[] = [];
    
    // Cálculo de primera derivada para detectar pendientes
    const derivatives: number[] = [];
    for (let i = 1; i < values.length; i++) {
      derivatives.push(values[i] - values[i-1]);
    }
    
    // Análisis de pendientes para identificar picos potenciales
    result.push(values[0]);
    for (let i = 1; i < values.length - 1; i++) {
      const isLocalPeak = derivatives[i-1] > 0 && derivatives[i] < 0;
      
      if (isLocalPeak) {
        // Amplificar picos detectados
        result.push(values[i] * this.peakEnhancementFactor);
      } else {
        // Mantener otros valores con suavizado
        const smoothed = values[i] * (1 - this.smoothingFactor) + 
                        values[i-1] * this.smoothingFactor;
        result.push(smoothed);
      }
    }
    result.push(values[values.length - 1]);
    
    return result;
  }
  
  /**
   * Calcula la calidad de la señal para frecuencia cardíaca
   * Implementa múltiples criterios especializados
   */
  private calculateSignalQuality(signal: ProcessedPPGSignal): number {
    // Iniciar con la calidad de señal base
    let quality = signal.quality;
    
    // Factor 1: Estabilidad de intervalos RR (si están disponibles)
    if (signal.rrIntervals && signal.rrIntervals.length > 1) {
      const rrVariability = this.calculateRRVariability(signal.rrIntervals);
      
      // Penalizar alta variabilidad (podría indicar artefactos)
      if (rrVariability > 0.2) {
        quality -= rrVariability * 25;
      }
    }
    
    // Factor 2: Amplitud de señal (señal débil reduce calidad)
    if (this.signalBuffer.length > 5) {
      const recentValues = this.signalBuffer.slice(-5).map(s => s.filteredValue);
      const amplitude = Math.max(...recentValues) - Math.min(...recentValues);
      
      if (amplitude < 0.1) {
        quality -= 15;
      }
    }
    
    // Garantizar rango válido
    return Math.max(0, Math.min(100, quality));
  }
  
  /**
   * Calcula la variabilidad de los intervalos RR
   */
  private calculateRRVariability(rrIntervals: number[]): number {
    if (rrIntervals.length < 2) return 0;
    
    // Calcular diferencias absolutas entre intervalos adyacentes
    const differences: number[] = [];
    for (let i = 1; i < rrIntervals.length; i++) {
      differences.push(Math.abs(rrIntervals[i] - rrIntervals[i-1]));
    }
    
    // Calcular promedio de diferencias
    const avgDifference = differences.reduce((sum, diff) => sum + diff, 0) / differences.length;
    
    // Normalizar al intervalo RR promedio
    const avgRR = rrIntervals.reduce((sum, rr) => sum + rr, 0) / rrIntervals.length;
    
    return avgDifference / avgRR;
  }
  
  /**
   * Calcula la confianza en la señal optimizada
   */
  private calculateConfidence(signal: ProcessedPPGSignal): number {
    // Base: calidad de señal normalizada
    let confidence = signal.quality / 100;
    
    // Factor: consistencia de detección de picos
    if (this.signalBuffer.length > 10) {
      const peakCount = this.signalBuffer.filter(s => s.isPeak).length;
      const expectedPeakCount = this.signalBuffer.length / 5; // Asumiendo ~12 por minuto
      
      const peakRatio = peakCount / expectedPeakCount;
      
      // Penalizar si hay muy pocos o demasiados picos
      if (peakRatio < 0.5 || peakRatio > 1.5) {
        confidence *= 0.8;
      }
    }
    
    // Factor: estabilidad del procesador (aumenta con cada feedback exitoso)
    confidence *= (1 + Math.min(0.2, this.feedbackCounter * 0.02));
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  // Método marcado como protegido para evitar conflictos de visibilidad
  protected applyFrequencyDomain(values: number[]): number[] {
    // Implementación específica para frecuencia cardíaca
    return values; // Implementación simplificada
  }
}
