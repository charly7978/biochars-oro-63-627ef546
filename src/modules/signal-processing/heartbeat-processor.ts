
/**
 * Procesador de latidos cardíacos
 * Detecta, valida y procesa picos de latidos
 */

import { ProcessedPPGSignal } from './types';
import { SignalProcessor } from './types';

export class HeartbeatProcessor implements SignalProcessor {
  private buffer: number[] = [];
  private bufferSize = 100;
  private peakBuffer: number[] = [];
  private peakTimestamps: number[] = [];
  private lastPeakTime: number | null = null;
  private bpmValue = 0;
  private thresholdValue = 0.2;
  private initialized = false;
  private rrIntervals: number[] = [];
  
  constructor() {
    this.reset();
  }
  
  /**
   * Inicializa el procesador
   */
  public initialize(): void {
    this.reset();
    this.initialized = true;
  }
  
  /**
   * Configura el procesador con parámetros específicos
   */
  public configure(options: { threshold?: number, bufferSize?: number }): void {
    if (options.threshold !== undefined) {
      this.thresholdValue = options.threshold;
    }
    
    if (options.bufferSize !== undefined) {
      this.bufferSize = options.bufferSize;
    }
  }
  
  /**
   * Procesa un valor de entrada y detecta latidos
   */
  public processSignal(input: number): ProcessedPPGSignal {
    // Verificar inicialización
    if (!this.initialized) {
      this.initialize();
    }
    
    // Añadir a buffer
    this.buffer.push(input);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
    
    // Detectar pico
    const { isPeak, timestamp } = this.detectPeak(input);
    
    if (isPeak) {
      this.peakBuffer.push(input);
      this.peakTimestamps.push(timestamp);
      
      // Mantener tamaño de buffer
      if (this.peakBuffer.length > 20) {
        this.peakBuffer.shift();
        this.peakTimestamps.shift();
      }
      
      // Calcular intervalo R-R
      if (this.lastPeakTime !== null) {
        const rrInterval = timestamp - this.lastPeakTime;
        
        // Validar intervalo (entre 300ms y 1500ms)
        if (rrInterval >= 300 && rrInterval <= 1500) {
          this.rrIntervals.push(rrInterval);
          
          // Mantener tamaño de buffer
          if (this.rrIntervals.length > 10) {
            this.rrIntervals.shift();
          }
          
          // Calcular BPM
          this.calculateBPM();
        }
      }
      
      this.lastPeakTime = timestamp;
    }
    
    // Crear resultado
    const result: ProcessedPPGSignal = {
      timestamp: timestamp,
      rawValue: input,
      normalizedValue: input, // Ya normalizado
      amplifiedValue: input, // Ya amplificado
      filteredValue: input, // Ya filtrado
      quality: this.calculateSignalQuality(),
      fingerDetected: true, // Asumimos dedo detectado
      signalStrength: 80, // Valor por defecto
      isPeak: isPeak,
      metadata: {
        bpm: this.bpmValue,
        rrIntervals: this.rrIntervals,
        lastPeakTime: this.lastPeakTime
      }
    };
    
    return result;
  }
  
  /**
   * Versión que acepta una señal PPG ya procesada
   */
  public processProcessedSignal(signal: ProcessedPPGSignal): ProcessedPPGSignal {
    // Verificar inicialización
    if (!this.initialized) {
      this.initialize();
    }
    
    // Añadir a buffer
    this.buffer.push(signal.filteredValue);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
    
    // Detectar pico
    const { isPeak, timestamp } = this.detectPeak(signal.filteredValue, signal.timestamp);
    
    if (isPeak) {
      this.peakBuffer.push(signal.filteredValue);
      this.peakTimestamps.push(timestamp);
      
      // Mantener tamaño de buffer
      if (this.peakBuffer.length > 20) {
        this.peakBuffer.shift();
        this.peakTimestamps.shift();
      }
      
      // Calcular intervalo R-R
      if (this.lastPeakTime !== null) {
        const rrInterval = timestamp - this.lastPeakTime;
        
        // Validar intervalo (entre 300ms y 1500ms)
        if (rrInterval >= 300 && rrInterval <= 1500) {
          this.rrIntervals.push(rrInterval);
          
          // Mantener tamaño de buffer
          if (this.rrIntervals.length > 10) {
            this.rrIntervals.shift();
          }
          
          // Calcular BPM
          this.calculateBPM();
        }
      }
      
      this.lastPeakTime = timestamp;
    }
    
    // Crear resultado con metadatos actualizados
    const result: ProcessedPPGSignal = {
      ...signal,
      isPeak: isPeak,
      metadata: {
        ...signal.metadata,
        bpm: this.bpmValue,
        rrIntervals: this.rrIntervals,
        lastPeakTime: this.lastPeakTime
      }
    };
    
    return result;
  }
  
  /**
   * Iniciar el procesador
   */
  public start(): void {
    this.initialized = true;
  }
  
  /**
   * Detener el procesador
   */
  public stop(): void {
    this.initialized = false;
  }
  
  /**
   * Resetear el procesador
   */
  public reset(): void {
    this.buffer = [];
    this.peakBuffer = [];
    this.peakTimestamps = [];
    this.lastPeakTime = null;
    this.bpmValue = 0;
    this.rrIntervals = [];
    this.initialized = false;
  }
  
  /**
   * Detecta si el valor actual es un pico
   */
  private detectPeak(value: number, timestamp: number = Date.now()): { isPeak: boolean, timestamp: number } {
    // Necesitamos al menos 3 muestras
    if (this.buffer.length < 3) {
      return { isPeak: false, timestamp };
    }
    
    // Ventana para detección
    const window = this.buffer.slice(-3);
    
    // Es pico si valor central es mayor que vecinos
    const isPeak = (
      window[1] > window[0] && 
      window[1] > window[2] && 
      window[1] > this.thresholdValue
    );
    
    return { isPeak, timestamp };
  }
  
  /**
   * Calcula el BPM basado en intervalos R-R
   */
  private calculateBPM(): void {
    if (this.rrIntervals.length < 2) {
      this.bpmValue = 0;
      return;
    }
    
    // Calcular promedio de intervalos (ms)
    const avgInterval = this.rrIntervals.reduce((sum, val) => sum + val, 0) / this.rrIntervals.length;
    
    // Convertir a BPM (60000 ms = 1 min)
    this.bpmValue = Math.round(60000 / avgInterval);
    
    // Limitar a rango realista
    this.bpmValue = Math.max(40, Math.min(200, this.bpmValue));
  }
  
  /**
   * Calcula la calidad de la señal de latidos
   */
  private calculateSignalQuality(): number {
    if (this.rrIntervals.length < 3) {
      return 50; // Calidad media por defecto
    }
    
    // Factores:
    // 1. Variabilidad de intervalos R-R (menor variabilidad = mayor calidad)
    const mean = this.rrIntervals.reduce((sum, val) => sum + val, 0) / this.rrIntervals.length;
    const variance = this.rrIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.rrIntervals.length;
    const cv = Math.sqrt(variance) / mean; // Coeficiente de variación
    
    // Calidad inversamente proporcional a variabilidad (hasta cierto punto)
    const regularityScore = 100 - Math.min(100, cv * 100);
    
    // 2. BPM en rango normal (60-100)
    const bpmRangeScore = 100 - Math.min(100, Math.abs(this.bpmValue - 80) * 2);
    
    // Calidad combinada
    const quality = regularityScore * 0.7 + bpmRangeScore * 0.3;
    
    return Math.max(0, Math.min(100, quality));
  }
}
