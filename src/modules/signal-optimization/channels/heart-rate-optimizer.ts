
/**
 * Optimizador de señal para frecuencia cardíaca
 */

import { BaseChannelOptimizer } from '../base-channel-optimizer';
import { OptimizedSignal, FeedbackData } from '../types';
import { ProcessedPPGSignal } from '../../signal-processing/types';

/**
 * Optimizador especializado para señales de frecuencia cardíaca
 */
export class HeartRateOptimizer extends BaseChannelOptimizer {
  private peakDetectionThreshold: number = 0.5;
  private lastPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private readonly MIN_PEAK_INTERVAL_MS = 400; // Mínimo tiempo entre picos (60/(400/1000)=150 BPM máx)
  
  constructor() {
    super('heartRate', {
      amplification: 1.5,
      filterStrength: 0.6,
      sensitivity: 1.2,
      smoothing: 0.15,
      noiseThreshold: 0.15,
      dynamicRange: 1.0
    });
    
    // Buffer más pequeño para respuesta rápida a cambios
    this._maxBufferSize = 60;
  }
  
  /**
   * Optimiza la señal para detección de frecuencia cardíaca
   */
  public optimize(signal: ProcessedPPGSignal): OptimizedSignal {
    // Amplificar señal
    const amplified = this.applyAdaptiveAmplification(signal.filteredValue);
    
    // Filtrar señal
    const filtered = this.applyAdaptiveFiltering(amplified);
    
    // Detectar picos para ritmo cardíaco
    const isPeak = this.detectPeak(filtered, signal.timestamp);
    
    // Actualizar estimación de ruido
    this.updateNoiseEstimate();
    
    // Procesar intervalos RR si hay metadatos disponibles
    if (signal.metadata?.rrIntervals) {
      this.rrIntervals = signal.metadata.rrIntervals;
      this.lastPeakTime = signal.metadata.lastPeakTime;
    }
    
    // Calcular confianza
    const confidence = this.calculateConfidence(signal);
    
    // Crear objeto optimizado
    return {
      channel: 'heartRate',
      timestamp: signal.timestamp,
      value: filtered,
      rawValue: signal.rawValue,
      amplified: amplified,
      filtered: filtered,
      confidence: confidence,
      quality: signal.quality,
      metadata: {
        isPeak: isPeak,
        rrIntervals: this.rrIntervals,
        lastPeakTime: this.lastPeakTime
      }
    };
  }
  
  /**
   * Detecta picos en la señal
   */
  private detectPeak(value: number, timestamp: number): boolean {
    if (this.lastPeakTime === null || timestamp - this.lastPeakTime >= this.MIN_PEAK_INTERVAL_MS) {
      if (value > this.peakDetectionThreshold && this.valueBuffer.length > 3) {
        // Verificar que sea mayor que valores recientes
        const recentValues = this.valueBuffer.slice(-3);
        if (value > Math.max(...recentValues)) {
          this.lastPeakTime = timestamp;
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Procesa retroalimentación del calculador
   */
  public processFeedback(feedback: FeedbackData): void {
    if (feedback.channel !== 'heartRate') return;
    
    // Escala de ajuste según magnitud
    const adjustmentScale = feedback.magnitude * 0.2;
    
    switch (feedback.adjustment) {
      case 'increase':
        // Incrementar amplificación
        this.parameters.amplification *= (1 + adjustmentScale);
        
        // Reducir umbral de detección
        this.peakDetectionThreshold *= (1 - adjustmentScale * 0.2);
        break;
        
      case 'decrease':
        // Reducir amplificación
        this.parameters.amplification *= (1 - adjustmentScale);
        
        // Incrementar filtrado
        this.parameters.filterStrength = Math.min(0.9, this.parameters.filterStrength * (1 + adjustmentScale * 0.5));
        
        // Aumentar umbral de detección
        this.peakDetectionThreshold *= (1 + adjustmentScale * 0.2);
        break;
        
      case 'fine-tune':
        // Ajustar parámetro específico si se proporciona
        if (feedback.parameter) {
          const param = feedback.parameter as keyof typeof this.parameters;
          if (this.parameters[param] !== undefined) {
            // Aplicar pequeño ajuste
            this.parameters[param] = this.parameters[param] * (1 + adjustmentScale * 0.1);
          }
        }
        break;
        
      case 'reset':
        // Restablecer parámetros por defecto
        this.reset();
        break;
    }
  }
  
  /**
   * Amplifica la señal específicamente para frecuencia cardíaca
   */
  private applyAdaptiveAmplification(value: number): number {
    // Implementar amplificación adaptativa basada en historia reciente
    const baseAmplification = this.parameters.amplification;
    
    // Si hay pocos datos en el buffer, usar amplificación base
    if (this.valueBuffer.length < 10) {
      return value * baseAmplification;
    }
    
    // Obtener estadísticas de valores recientes
    const recentValues = this.valueBuffer.slice(-10);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const minVal = Math.min(...recentValues);
    const maxVal = Math.max(...recentValues);
    const range = maxVal - minVal;
    
    // Calcular factor de amplificación adaptativo
    let adaptiveFactor = baseAmplification;
    
    // Si el rango es muy pequeño, aumentar amplificación
    if (range < 0.2) {
      adaptiveFactor *= 1.5;
    }
    // Si el valor está cerca de la media, amplificar más para destacar picos
    if (Math.abs(value - mean) < range * 0.3) {
      adaptiveFactor *= 1.2;
    }
    
    return value * adaptiveFactor;
  }
}
