
/**
 * Procesador avanzado de latidos cardíacos
 * Extrae y procesa señales de latido con algoritmos de vanguardia
 */

import { ProcessedPPGSignal, PPGProcessingOptions } from './types';
import { detectFinger } from './utils/finger-detector';

export class HeartbeatProcessor {
  private values: number[] = [];
  private filteredValues: number[] = [];
  private readonly maxBufferSize: number = 100;
  private fingerDetectionCounter: number = 0;
  private lastPeakTime: number | null = null;
  private peakThreshold: number = 0.15;
  private rrIntervals: number[] = [];
  private adaptiveThreshold: number = 0.2;
  private readonly options: PPGProcessingOptions;
  
  constructor(options: PPGProcessingOptions = {}) {
    this.options = {
      fingerDetectionThreshold: 0.1,
      peakDetectionThreshold: 0.15,
      filterWindowSize: 5,
      mode: 'adaptive',
      amplificationFactor: 1.2,
      ...options
    };
    
    this.peakThreshold = this.options.peakDetectionThreshold || 0.15;
  }
  
  /**
   * Procesa un valor de señal PPG para extraer componentes de latido
   */
  public processSignal(value: number): ProcessedPPGSignal {
    const timestamp = Date.now();
    
    // Añadir valor a buffers
    this.addValue(value);
    
    // Filtrar señal para eliminar ruido
    const filteredValue = this.filterSignal(value);
    this.filteredValues.push(filteredValue);
    
    if (this.filteredValues.length > this.maxBufferSize) {
      this.filteredValues.shift();
    }
    
    // Detectar dedo
    const { detected: fingerDetected, updatedCounter } = detectFinger(
      this.filteredValues.slice(-10),
      this.fingerDetectionCounter
    );
    this.fingerDetectionCounter = updatedCounter;
    
    // Detectar picos si hay dedo detectado
    let isPeak = false;
    if (fingerDetected) {
      isPeak = this.detectPeak(filteredValue);
      
      // Si es un pico, actualizar lastPeakTime y calcular RR interval
      if (isPeak && this.lastPeakTime !== null) {
        const currentRR = timestamp - this.lastPeakTime;
        
        // Solo añadir intervalos RR fisiológicamente plausibles (300-1500ms)
        if (currentRR >= 300 && currentRR <= 1500) {
          this.rrIntervals.push(currentRR);
          
          // Mantener solo los últimos 8 intervalos RR
          if (this.rrIntervals.length > 8) {
            this.rrIntervals.shift();
          }
          
          // Actualizar umbral adaptativo basado en los últimos picos
          this.updateAdaptiveThreshold();
        }
      }
      
      if (isPeak) {
        this.lastPeakTime = timestamp;
      }
    } else {
      // Resetear intervalos RR si no hay dedo detectado
      this.rrIntervals = [];
      this.lastPeakTime = null;
    }
    
    // Calcular calidad de señal
    const quality = this.calculateSignalQuality(fingerDetected);
    
    return {
      rawValue: value,
      filteredValue,
      timestamp,
      quality,
      fingerDetected,
      isPeak,
      lastPeakTime: this.lastPeakTime,
      rrIntervals: [...this.rrIntervals],
      normalizedValue: filteredValue, // Para compatibilidad con otros módulos
      amplifiedValue: filteredValue * (this.options.amplificationFactor || 1.0),
      signalStrength: quality
    };
  }
  
  /**
   * Añade un valor al buffer
   */
  private addValue(value: number): void {
    this.values.push(value);
    if (this.values.length > this.maxBufferSize) {
      this.values.shift();
    }
  }
  
  /**
   * Aplica filtrado avanzado para reducir ruido
   */
  private filterSignal(value: number): number {
    // Si no hay suficientes valores para filtrar, devolver el valor actual
    if (this.values.length < 3) return value;
    
    const windowSize = this.options.filterWindowSize || 5;
    const halfWindow = Math.floor(windowSize / 2);
    
    // Obtener ventana de valores para filtrado
    const valueWindow = this.values.slice(-windowSize);
    
    if (valueWindow.length < windowSize) {
      // Si no hay suficientes valores, usar filtro básico
      const alpha = 0.3;
      return alpha * value + (1 - alpha) * this.filteredValues[this.filteredValues.length - 1];
    }
    
    // Implementar filtro de mediana para eliminar outliers
    const medianValue = this.calculateMedian([...valueWindow]);
    
    // Combinar con filtro de media móvil ponderada
    const weights = [0.1, 0.2, 0.4, 0.2, 0.1]; // Ejemplo para windowSize=5
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < valueWindow.length; i++) {
      const weight = i < weights.length ? weights[i] : 0.1;
      weightedSum += valueWindow[i] * weight;
      weightSum += weight;
    }
    
    const avgValue = weightedSum / weightSum;
    
    // Combinar mediana y media ponderada
    return 0.7 * medianValue + 0.3 * avgValue;
  }
  
  /**
   * Calcular mediana de un array
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    values.sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    
    if (values.length % 2 === 0) {
      return (values[middle - 1] + values[middle]) / 2;
    } else {
      return values[middle];
    }
  }
  
  /**
   * Detector de picos cardíacos avanzado con umbral adaptativo
   */
  private detectPeak(value: number): boolean {
    if (this.filteredValues.length < 3) return false;
    
    const threshold = this.options.mode === 'adaptive' ? 
                       this.adaptiveThreshold : this.peakThreshold;
    
    const prev1 = this.filteredValues[this.filteredValues.length - 2];
    const prev2 = this.filteredValues[this.filteredValues.length - 3];
    
    // Detección de picos con umbral adaptativamente ajustado
    const isPeak = value > prev1 && prev1 > prev2 && 
                   (value - prev2) > threshold;
    
    return isPeak;
  }
  
  /**
   * Actualiza umbral adaptativo basado en histórico de señal
   */
  private updateAdaptiveThreshold(): void {
    if (this.filteredValues.length < 10) return;
    
    // Calcular amplitud promedio de señal reciente
    const recentValues = this.filteredValues.slice(-20);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Ajustar umbral como porcentaje de la amplitud
    this.adaptiveThreshold = amplitude * 0.3;
    
    // Mantener umbral en límites razonables
    this.adaptiveThreshold = Math.max(0.05, Math.min(0.5, this.adaptiveThreshold));
  }
  
  /**
   * Calcula la calidad de la señal basada en múltiples factores
   */
  private calculateSignalQuality(fingerDetected: boolean): number {
    if (!fingerDetected) return 0;
    
    // Partir de una calidad base
    let quality = 60;
    
    // Factor 1: Estabilidad de señal
    if (this.filteredValues.length >= 10) {
      const recentValues = this.filteredValues.slice(-10);
      const min = Math.min(...recentValues);
      const max = Math.max(...recentValues);
      const amplitude = max - min;
      
      // Penalizar señales de muy baja amplitud
      if (amplitude < 0.05) {
        quality -= 30;
      } 
      // Recompensar señales de amplitud adecuada
      else if (amplitude > 0.1 && amplitude < 0.5) {
        quality += 15;
      }
      
      // Calcular varianza para medir estabilidad
      const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
      
      // Penalizar alta varianza (señal inestable)
      if (variance > 0.01) {
        quality -= Math.min(30, variance * 1000);
      }
    }
    
    // Factor 2: Consistencia de intervalos RR
    if (this.rrIntervals.length >= 3) {
      const rrMean = this.rrIntervals.reduce((sum, val) => sum + val, 0) / this.rrIntervals.length;
      const rrDeviations = this.rrIntervals.map(rr => Math.abs(rr - rrMean) / rrMean);
      const avgDeviation = rrDeviations.reduce((sum, val) => sum + val, 0) / rrDeviations.length;
      
      // Recompensar baja desviación (latidos regulares)
      if (avgDeviation < 0.1) {
        quality += 20;
      }
      // Penalizar alta desviación (posibles errores de detección)
      else if (avgDeviation > 0.2) {
        quality -= avgDeviation * 50;
      }
    }
    
    // Garantizar rango válido
    return Math.max(0, Math.min(100, quality));
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.values = [];
    this.filteredValues = [];
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.fingerDetectionCounter = 0;
  }
}
