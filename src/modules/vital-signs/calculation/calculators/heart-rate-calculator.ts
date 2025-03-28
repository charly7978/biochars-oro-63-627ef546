
/**
 * Calculador especializado para frecuencia cardíaca
 */

import { BaseCalculator } from './base-calculator';
import { VitalSignCalculation } from '../types';
import { OptimizedSignal } from '../../../signal-optimization/types';

export class HeartRateCalculator extends BaseCalculator {
  private peakDetector: PeakDetector;
  private rrIntervals: number[] = [];
  private readonly MAX_RR_INTERVALS = 10;
  
  constructor() {
    super('heartRate');
    this.peakDetector = new PeakDetector();
  }
  
  /**
   * Calcula la frecuencia cardíaca a partir de señal optimizada
   */
  protected performCalculation(signal: OptimizedSignal): VitalSignCalculation {
    // Detectar pico cardíaco
    const { isPeak, confidence: peakConfidence } = 
      this.peakDetector.detectPeak(signal.optimizedValue, this.valueBuffer);
    
    // Si es un pico, registrarlo y actualizar intervalos RR
    if (isPeak) {
      const lastPeakTime = this.peakDetector.getLastPeakTime();
      if (lastPeakTime) {
        const interval = signal.timestamp - lastPeakTime;
        
        // Solo añadir intervalos válidos (40-200 BPM)
        if (interval >= 300 && interval <= 1500) {
          this.rrIntervals.push(interval);
          
          // Mantener buffer limitado
          if (this.rrIntervals.length > this.MAX_RR_INTERVALS) {
            this.rrIntervals.shift();
          }
        }
      }
      
      // Actualizar tiempo de último pico
      this.peakDetector.setLastPeakTime(signal.timestamp);
    }
    
    // Calcular BPM a partir de intervalos RR
    const { bpm, confidence: bpmConfidence } = this.calculateBPM();
    
    // Añadir metadatos para arritmias
    const metadata = {
      isPeak,
      rrIntervals: [...this.rrIntervals],
      lastPeakTime: this.peakDetector.getLastPeakTime()
    };
    
    // Generar sugerencias para el optimizador basado en calidad
    this.updateOptimizationSuggestions(bpmConfidence);
    
    return {
      value: bpm,
      confidence: bpmConfidence,
      timestamp: signal.timestamp,
      metadata
    };
  }
  
  /**
   * Calcula BPM a partir de intervalos RR
   */
  private calculateBPM(): { bpm: number, confidence: number } {
    if (this.rrIntervals.length < 3) {
      return { bpm: 0, confidence: 0 };
    }
    
    // Filtrar intervalos anómalos
    const validIntervals = this.rrIntervals.filter(
      interval => interval >= 300 && interval <= 1500
    );
    
    if (validIntervals.length < 3) {
      return { bpm: 0, confidence: 0 };
    }
    
    // Calcular promedio de intervalos
    const avgInterval = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    
    // Convertir a BPM
    const bpm = Math.round(60000 / avgInterval);
    
    // Calcular confianza basada en consistencia de intervalos
    const stdDev = Math.sqrt(
      validIntervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / validIntervals.length
    );
    
    // Normalizar desviación estándar como medida de confianza
    const normalizedStdDev = Math.min(1, stdDev / avgInterval);
    const consistency = 1 - normalizedStdDev;
    
    // Calcular confianza final combinando consistencia y número de muestras
    const sampleConfidence = Math.min(1, validIntervals.length / 10);
    const confidence = (consistency * 0.7) + (sampleConfidence * 0.3);
    
    return {
      bpm: Math.max(40, Math.min(200, bpm)), // Limitar a rango fisiológico
      confidence
    };
  }
  
  /**
   * Actualiza sugerencias para optimizador basado en calidad de señal
   */
  private updateOptimizationSuggestions(confidence: number): void {
    if (confidence < 0.3) {
      // Baja confianza: aumentar amplificación y sensibilidad
      this.suggestedParameters = {
        amplification: 2.0,
        sensitivity: 1.2,
        filterStrength: 0.7
      };
    } else if (confidence < 0.6) {
      // Confianza media: ajustes moderados
      this.suggestedParameters = {
        amplification: 1.5,
        sensitivity: 1.1,
        filterStrength: 0.6
      };
    } else {
      // Alta confianza: optimizaciones mínimas
      this.suggestedParameters = {};
    }
  }
  
  /**
   * Reinicia el calculador
   */
  public reset(): void {
    super.reset();
    this.peakDetector.reset();
    this.rrIntervals = [];
  }
}

/**
 * Detector de picos cardíacos
 */
class PeakDetector {
  private lastValues: number[] = [];
  private readonly MAX_VALUES = 5;
  private lastPeakTime: number | null = null;
  private readonly MIN_PEAK_DISTANCE_MS = 300; // Mínimo tiempo entre picos (máximo 200bpm)
  private readonly MIN_PEAK_THRESHOLD = 0.15;
  
  /**
   * Detecta si un valor representa un pico cardíaco
   */
  public detectPeak(value: number, context: number[]): { isPeak: boolean, confidence: number } {
    // Actualizar buffer de valores
    this.lastValues.push(value);
    if (this.lastValues.length > this.MAX_VALUES) {
      this.lastValues.shift();
    }
    
    // Necesitamos al menos 3 valores para detectar un pico
    if (this.lastValues.length < 3) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Verificar si es un máximo local
    const isLocalMax = 
      this.lastValues[1] > this.lastValues[0] && 
      this.lastValues[1] > this.lastValues[2] &&
      this.lastValues[1] > this.MIN_PEAK_THRESHOLD;
    
    if (!isLocalMax) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Verificar tiempo desde último pico
    const now = Date.now();
    if (this.lastPeakTime && (now - this.lastPeakTime) < this.MIN_PEAK_DISTANCE_MS) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Calcular prominencia del pico
    const prominence = Math.min(
      this.lastValues[1] - this.lastValues[0],
      this.lastValues[1] - this.lastValues[2]
    );
    
    // Calcular confianza basada en prominencia
    const confidence = Math.min(1, prominence * 5);
    
    return { isPeak: true, confidence };
  }
  
  /**
   * Establece tiempo de último pico
   */
  public setLastPeakTime(time: number): void {
    this.lastPeakTime = time;
  }
  
  /**
   * Obtiene tiempo de último pico
   */
  public getLastPeakTime(): number | null {
    return this.lastPeakTime;
  }
  
  /**
   * Reinicia detector de picos
   */
  public reset(): void {
    this.lastValues = [];
    this.lastPeakTime = null;
  }
}
