
/**
 * Procesador de señales que implementa técnicas reales de procesamiento
 */

import { applySMAFilter, calculatePerfusionIndex } from '../../utils/vitalSignsUtils';

export interface ProcessedSignal {
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  rawValue?: number;
}

export class SignalProcessor {
  private readonly BUFFER_SIZE = 300;
  private readonly SMA_WINDOW_SIZE = 5;
  
  // Umbrales realistas basados en investigación
  private readonly QUALITY_THRESHOLD = 30; // Umbral de calidad mínima aceptable
  private readonly FINGER_DETECTION_THRESHOLD = 50; // Umbral para detección de dedo
  
  private ppgValues: number[] = [];
  private smaBuffer: number[] = [];
  private lastProcessedTime: number = 0;
  private consecutiveFingerFrames: number = 0;
  private readonly MIN_FINGER_FRAMES = 5; // Mínimo de frames para confirmar detección
  
  /**
   * Procesa la señal PPG aplicando filtrado y análisis de calidad
   */
  public processSignal(value: number): ProcessedSignal {
    // VERIFICACIÓN CRÍTICA: Comprobar si el valor indica ausencia de dedo
    // Valores muy bajos o cero indican que no hay dedo
    const isPossiblyValidValue = value > 10 && value < 250;
    
    // Aplicar filtro SMA para reducción de ruido
    const { filteredValue, updatedBuffer } = applySMAFilter(value, this.smaBuffer, this.SMA_WINDOW_SIZE);
    this.smaBuffer = updatedBuffer;
    
    // Actualizar buffer de valores
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > this.BUFFER_SIZE) {
      this.ppgValues.shift();
    }
    
    // Análisis de señal para calidad y detección de dedo
    const { quality, fingerDetected } = this.analyzeSignal(filteredValue, isPossiblyValidValue);
    
    // Actualizar tiempo de procesamiento
    this.lastProcessedTime = Date.now();
    
    return {
      filteredValue,
      quality,
      fingerDetected,
      rawValue: value
    };
  }
  
  /**
   * Analiza la calidad de la señal y detecta si hay un dedo presente
   */
  private analyzeSignal(value: number, isPossiblyValidValue: boolean): { quality: number, fingerDetected: boolean } {
    // Calcular calidad basada en características de la señal
    let quality = 0;
    
    // Si el valor no es válido, no hay dedo
    if (!isPossiblyValidValue) {
      this.consecutiveFingerFrames = 0;
      return { quality: 0, fingerDetected: false };
    }
    
    if (this.ppgValues.length >= 10) {
      const recentValues = this.ppgValues.slice(-10);
      
      // Calcular estadísticas básicas
      const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
      const min = Math.min(...recentValues);
      const max = Math.max(...recentValues);
      const range = max - min;
      
      // Calcular variabilidad (desviación estándar)
      const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
      const stdDev = Math.sqrt(variance);
      
      // Calcular indicadores de calidad
      const snr = range / (stdDev > 0 ? stdDev : 1); // Relación señal-ruido
      const perfusion = calculatePerfusionIndex(min, max);
      
      // Calcular puntuación de calidad (0-100)
      quality = Math.min(100, Math.max(0, 
        (snr * 10) + (perfusion * 100) + (range * 5)
      ));
      
      // VERIFICACIÓN CRÍTICA: Asegurar que hay suficiente variación para ser una señal PPG real
      const hasEnoughVariation = range > 10 && stdDev > 2;
      
      // Actualizar conteo de frames consecutivos con dedo
      if (quality >= this.QUALITY_THRESHOLD && hasEnoughVariation) {
        this.consecutiveFingerFrames = Math.min(this.consecutiveFingerFrames + 1, 20);
      } else {
        this.consecutiveFingerFrames = Math.max(0, this.consecutiveFingerFrames - 1);
      }
      
      console.log("SignalProcessor: Análisis de señal", {
        calidad: quality,
        rango: range,
        desviación: stdDev,
        framesConsecutivos: this.consecutiveFingerFrames,
        hayDedo: this.consecutiveFingerFrames >= this.MIN_FINGER_FRAMES
      });
    }
    
    // Determinar si hay un dedo presente basado en calidad y consistencia
    const fingerDetected = this.consecutiveFingerFrames >= this.MIN_FINGER_FRAMES;
    
    return { quality, fingerDetected };
  }
  
  /**
   * Obtiene los valores PPG actuales
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.ppgValues = [];
    this.smaBuffer = [];
    this.consecutiveFingerFrames = 0;
  }
}
