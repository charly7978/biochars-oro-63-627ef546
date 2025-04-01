
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Procesador de señal PPG unificado
 * Consolida la funcionalidad de PPGProcessor, HeartbeatProcessor, etc.
 */

import { 
  ProcessedPPGSignal, 
  SignalProcessorOptions, 
  SignalQualityMetrics,
  ProcessingError
} from './types';
import { OptimizedPPGBuffer } from '../../../hooks/heart-beat/signal-processing/optimized-buffer';

/**
 * Procesador unificado que combina la funcionalidad de múltiples procesadores
 */
export class UnifiedSignalProcessor {
  // Buffers para procesamiento
  private valuesBuffer: OptimizedPPGBuffer<{ value: number, timestamp: number }>;
  private filteredBuffer: OptimizedPPGBuffer<{ value: number, timestamp: number }>;
  private peakTimes: number[] = [];
  private rrIntervals: number[] = [];
  
  // Configuración
  private amplificationFactor: number = 1.2;
  private filterStrength: number = 0.25;
  private qualityThreshold: number = 30;
  private fingerDetectionSensitivity: number = 0.6;
  private peakThreshold: number = 0.2;
  private minPeakDistance: number = 250; // ms
  
  // Estado
  private lastPeakTime: number | null = null;
  private arrhythmiaCounter: number = 0;
  private consecutiveWeakSignals: number = 0;
  
  // Callbacks
  private onSignalReady?: (signal: ProcessedPPGSignal) => void;
  private onError?: (error: Error) => void;
  
  constructor(options?: SignalProcessorOptions) {
    // Inicializar buffers
    this.valuesBuffer = new OptimizedPPGBuffer<{ value: number, timestamp: number }>(30);
    this.filteredBuffer = new OptimizedPPGBuffer<{ value: number, timestamp: number }>(30);
    
    // Aplicar opciones si se proporcionan
    if (options) {
      this.configure(options);
    }
  }
  
  /**
   * Procesa un valor de señal PPG
   */
  public processSignal(value: number): ProcessedPPGSignal {
    const timestamp = Date.now();
    
    try {
      // Guardar valor original
      this.valuesBuffer.push({ value, timestamp });
      
      // Aplicar filtro adaptativo
      const filteredValue = this.applyAdaptiveFilter(value);
      this.filteredBuffer.push({ value: filteredValue, timestamp });
      
      // Normalizar y amplificar
      const normalizedValue = this.normalizeSignal(filteredValue);
      const amplifiedValue = this.amplifySignal(normalizedValue);
      
      // Evaluación de calidad y detección de dedo
      const quality = this.evaluateSignalQuality(value, filteredValue);
      const fingerDetected = this.detectFingerPresence();
      
      // Calcular fuerza de señal
      const signalStrength = this.calculateSignalStrength();
      
      // Detectar pico cardíaco
      const heartbeatInfo = this.detectHeartbeat(filteredValue, timestamp);
      
      // Crear resultado
      const result: ProcessedPPGSignal = {
        timestamp,
        rawValue: value,
        filteredValue,
        normalizedValue,
        amplifiedValue,
        quality,
        fingerDetected,
        signalStrength,
        isPeak: heartbeatInfo.isPeak,
        peakConfidence: heartbeatInfo.confidence,
        instantaneousBPM: heartbeatInfo.bpm,
        rrInterval: heartbeatInfo.rrInterval,
        heartRateVariability: heartbeatInfo.hrv,
        arrhythmiaCount: this.arrhythmiaCounter
      };
      
      // Callback si está definido
      if (this.onSignalReady) {
        this.onSignalReady(result);
      }
      
      return result;
    } catch (error) {
      // Manejar error
      const processingError: ProcessingError = error instanceof Error 
        ? Object.assign(error, { code: 'SIGNAL_PROCESSING_ERROR', timestamp }) 
        : new Error('Unknown error') as ProcessingError;
      
      if (this.onError) {
        this.onError(processingError);
      }
      
      // Devolver resultado vacío
      return {
        timestamp,
        rawValue: value,
        filteredValue: value,
        normalizedValue: value,
        amplifiedValue: value,
        quality: 0,
        fingerDetected: false,
        signalStrength: 0,
        isPeak: false,
        peakConfidence: 0,
        instantaneousBPM: null,
        rrInterval: null,
        heartRateVariability: null,
        arrhythmiaCount: this.arrhythmiaCounter
      };
    }
  }
  
  /**
   * Normaliza la señal
   */
  private normalizeSignal(value: number): number {
    const values = this.filteredBuffer.getValues();
    if (values.length < 3) return value;
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    if (range === 0) return 0;
    
    return (value - min) / range;
  }
  
  /**
   * Amplifica la señal
   */
  private amplifySignal(value: number): number {
    return value * this.amplificationFactor;
  }
  
  /**
   * Evalúa la calidad de la señal
   */
  private evaluateSignalQuality(raw: number, filtered: number): number {
    const values = this.filteredBuffer.getValues();
    if (values.length < 5) return 0;
    
    // Calcular varianza como medida de calidad
    const variance = this.calculateVariance(values);
    const amplitudRange = Math.max(...values) - Math.min(...values);
    
    // Señal débil tiene baja calidad
    if (amplitudRange < 0.01) return Math.max(0, Math.min(20, this.qualityThreshold / 2));
    
    // Ruido excesivo tiene baja calidad
    if (variance > 0.1) return Math.max(0, Math.min(40, this.qualityThreshold));
    
    // Señal buena tiene alta calidad
    const baseQuality = Math.min(100, 100 - variance * 500);
    return Math.max(0, Math.min(100, baseQuality));
  }
  
  /**
   * Detecta presencia de dedo
   */
  private detectFingerPresence(): boolean {
    const values = this.filteredBuffer.getValues();
    if (values.length < 10) return false;
    
    // Amplitud como medida principal
    const min = Math.min(...values);
    const max = Math.max(...values);
    const amplitude = max - min;
    
    // Varianza como medida secundaria
    const variance = this.calculateVariance(values);
    
    // Criterios combinados
    const hasAmplitude = amplitude >= this.fingerDetectionSensitivity * 0.05;
    const hasReasonableVariance = variance < 0.1 && variance > 0.0001;
    
    return hasAmplitude && hasReasonableVariance;
  }
  
  /**
   * Aplica un filtro adaptativo a la señal
   */
  private applyAdaptiveFilter(value: number): number {
    if (this.valuesBuffer.size() < 3) return value;
    
    // Calcular variabilidad reciente
    const recent = this.valuesBuffer.getValues();
    const variance = this.calculateVariance(recent);
    
    // Ajustar fuerza de filtrado según varianza
    const adaptiveAlpha = this.adjustFilterStrength(variance);
    
    // Aplicar filtro exponencial con alfa adaptativo
    const lastFiltered = this.filteredBuffer.size() > 0 
      ? this.filteredBuffer.getValues()[this.filteredBuffer.size() - 1] 
      : value;
      
    return adaptiveAlpha * value + (1 - adaptiveAlpha) * lastFiltered;
  }
  
  /**
   * Detecta picos cardíacos y calcula información relacionada
   */
  private detectHeartbeat(value: number, timestamp: number): {
    isPeak: boolean;
    confidence: number;
    bpm: number | null;
    rrInterval: number | null;
    hrv: number | null;
  } {
    let isPeak = false;
    let confidence = 0;
    let instantaneousBPM: number | null = null;
    let rrInterval: number | null = null;
    
    // Verificar condiciones básicas para pico
    const timeSinceLastPeak = this.lastPeakTime ? timestamp - this.lastPeakTime : Number.MAX_VALUE;
    
    if (value > this.peakThreshold && timeSinceLastPeak >= this.minPeakDistance) {
      // Verificar si es un máximo local
      if (this.isLocalMaximum(value)) {
        isPeak = true;
        confidence = 0.85; // Valor simple para demostración
        
        // Calcular intervalo RR y BPM si hay un pico anterior
        if (this.lastPeakTime !== null) {
          rrInterval = timestamp - this.lastPeakTime;
          
          // Calcular BPM instantáneo
          if (rrInterval > 0) {
            instantaneousBPM = 60000 / rrInterval;
            
            // Almacenar intervalo RR
            this.rrIntervals.push(rrInterval);
            if (this.rrIntervals.length > 10) {
              this.rrIntervals.shift();
            }
            
            // Comprobar arrhythmia
            if (this.rrIntervals.length >= 3) {
              if (this.detectArrhythmia(this.rrIntervals)) {
                this.arrhythmiaCounter++;
              }
            }
          }
        }
        
        // Actualizar referencia de pico
        this.lastPeakTime = timestamp;
        this.peakTimes.push(timestamp);
        
        // Limitar historial
        if (this.peakTimes.length > 10) {
          this.peakTimes.shift();
        }
      }
    }
    
    // Calcular HRV
    const hrv = this.calculateHRV();
    
    return {
      isPeak,
      confidence,
      bpm: instantaneousBPM,
      rrInterval,
      hrv
    };
  }
  
  /**
   * Verifica si un valor es un máximo local
   */
  private isLocalMaximum(value: number): boolean {
    if (this.filteredBuffer.size() < 3) return false;
    
    const values = this.filteredBuffer.getValues();
    const lastIndex = values.length - 1;
    
    return (lastIndex > 0 && 
            values[lastIndex - 1] < values[lastIndex] && 
            values[lastIndex] >= value);
  }
  
  /**
   * Detecta arritmias basadas en intervalos RR
   */
  private detectArrhythmia(rrIntervals: number[]): boolean {
    if (rrIntervals.length < 3) return false;
    
    // Algoritmo simple: variación significativa en intervalos consecutivos
    const lastThree = rrIntervals.slice(-3);
    const avg = lastThree.reduce((sum, val) => sum + val, 0) / lastThree.length;
    
    // Calcular variaciones
    const variations = lastThree.map(interval => Math.abs(interval - avg) / avg);
    
    // Si alguna variación es mayor al 20%, considerar arritmia
    return variations.some(variation => variation > 0.2);
  }
  
  /**
   * Calcula la variabilidad del ritmo cardíaco
   */
  private calculateHRV(): number | null {
    if (this.rrIntervals.length < 3) return null;
    
    // Método RMSSD (Root Mean Square of Successive Differences)
    let sumSquaredDiffs = 0;
    for (let i = 1; i < this.rrIntervals.length; i++) {
      const diff = this.rrIntervals[i] - this.rrIntervals[i - 1];
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiffs / (this.rrIntervals.length - 1));
  }
  
  /**
   * Calcula la fuerza de la señal basada en amplitud
   */
  private calculateSignalStrength(): number {
    if (this.filteredBuffer.size() < 5) return 0;
    
    const values = this.filteredBuffer.getValues();
    const min = Math.min(...values);
    const max = Math.max(...values);
    const amplitude = max - min;
    
    // Normalizar a un rango 0-100
    return Math.min(100, Math.max(0, amplitude * 100));
  }
  
  /**
   * Ajusta la fuerza del filtrado según la varianza
   */
  private adjustFilterStrength(variance: number): number {
    // Si la varianza es alta (señal ruidosa), filtrar más fuerte
    if (variance > 0.05) return Math.min(0.15, this.filterStrength / 2);
    
    // Si la varianza es baja (señal estable), filtrar más suave
    if (variance < 0.01) return Math.min(0.4, this.filterStrength * 1.5);
    
    // Caso intermedio
    return this.filterStrength;
  }
  
  /**
   * Calcula la varianza de un conjunto de valores
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }
  
  /**
   * Comprueba si la señal es débil
   */
  public checkWeakSignal(value: number): { isWeakSignal: boolean, updatedWeakSignalsCount: number } {
    const WEAK_SIGNAL_THRESHOLD = 0.02;
    const MAX_CONSECUTIVE_WEAK_SIGNALS = 15;
    
    if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
      this.consecutiveWeakSignals++;
    } else {
      this.consecutiveWeakSignals = 0;
    }
    
    return {
      isWeakSignal: this.consecutiveWeakSignals > MAX_CONSECUTIVE_WEAK_SIGNALS,
      updatedWeakSignalsCount: this.consecutiveWeakSignals
    };
  }
  
  /**
   * Configura el procesador
   */
  public configure(options: SignalProcessorOptions): void {
    if (options.amplificationFactor !== undefined) {
      this.amplificationFactor = options.amplificationFactor;
    }
    
    if (options.filterStrength !== undefined) {
      this.filterStrength = options.filterStrength;
    }
    
    if (options.qualityThreshold !== undefined) {
      this.qualityThreshold = options.qualityThreshold;
    }
    
    if (options.fingerDetectionSensitivity !== undefined) {
      this.fingerDetectionSensitivity = options.fingerDetectionSensitivity;
    }
    
    if (options.peakThreshold !== undefined) {
      this.peakThreshold = options.peakThreshold;
    }
    
    if (options.minPeakDistance !== undefined) {
      this.minPeakDistance = options.minPeakDistance;
    }
    
    if (options.onSignalReady !== undefined) {
      this.onSignalReady = options.onSignalReady;
    }
    
    if (options.onError !== undefined) {
      this.onError = options.onError;
    }
  }
  
  /**
   * Obtiene la calidad actual de la señal
   */
  public getSignalQualityMetrics(): SignalQualityMetrics {
    const values = this.filteredBuffer.getValues();
    
    // Calcular amplitud
    let amplitude = 0;
    if (values.length > 5) {
      amplitude = Math.max(...values) - Math.min(...values);
    }
    
    // Calcular calidad de señal
    const quality = this.evaluateSignalQuality(
      this.valuesBuffer.size() > 0 ? this.valuesBuffer.getValues()[0] : 0,
      this.filteredBuffer.size() > 0 ? this.filteredBuffer.getValues()[0] : 0
    );
    
    return {
      quality,
      amplitude,
      signalStrength: this.calculateSignalStrength(),
      weakSignalCount: this.consecutiveWeakSignals
    };
  }
  
  /**
   * Obtiene datos de intervalos RR
   */
  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    return {
      intervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime
    };
  }
  
  /**
   * Obtiene el contador de arritmias
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.valuesBuffer = new OptimizedPPGBuffer<{ value: number, timestamp: number }>(30);
    this.filteredBuffer = new OptimizedPPGBuffer<{ value: number, timestamp: number }>(30);
    this.peakTimes = [];
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.consecutiveWeakSignals = 0;
  }
  
  /**
   * Reinicia completamente el procesador incluyendo contador de arritmias
   */
  public fullReset(): void {
    this.reset();
    this.arrhythmiaCounter = 0;
  }
}

/**
 * Crea una nueva instancia del procesador unificado
 */
export function createUnifiedSignalProcessor(options?: SignalProcessorOptions): UnifiedSignalProcessor {
  return new UnifiedSignalProcessor(options);
}
