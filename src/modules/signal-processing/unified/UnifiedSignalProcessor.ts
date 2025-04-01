
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Procesador unificado de señales PPG
 */

import { ProcessedPPGSignal, UnifiedProcessorOptions, SignalQualityMetrics } from './types';
import { OptimizedCircularBuffer } from '../../extraction/OptimizedCircularBuffer';
import { evaluateSignalQuality } from '../utils/quality-detector';

/**
 * Procesador unificado que maneja todo el pipeline de procesamiento de señal PPG
 */
export class UnifiedSignalProcessor {
  // Estado interno
  private isProcessing: boolean = false;
  private signalBuffer: number[] = [];
  private peakBuffer: number[] = [];
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private arrhythmiaCounter: number = 0;
  
  // Resultados y métricas
  private _lastSignal: ProcessedPPGSignal | null = null;
  
  // Opciones y callbacks
  private options: Required<UnifiedProcessorOptions>;
  private onSignalReady?: (signal: ProcessedPPGSignal) => void;
  private onError?: (error: Error) => void;
  
  /**
   * Opciones por defecto para el procesador
   */
  private static DEFAULT_OPTIONS: Required<UnifiedProcessorOptions> = {
    bufferSize: 30,
    sampleRate: 30,
    peakDetectionThreshold: 0.1,
    qualityThreshold: 30,
    amplificationFactor: 1.2,
    useAdvancedFiltering: true,
    onSignalReady: undefined,
    onError: undefined
  };
  
  constructor(options?: UnifiedProcessorOptions) {
    // Aplicar opciones por defecto
    this.options = {
      ...UnifiedSignalProcessor.DEFAULT_OPTIONS,
      ...options
    };
    
    // Extraer callbacks
    this.onSignalReady = this.options.onSignalReady;
    this.onError = this.options.onError;
    
    // Inicializar estado
    this.reset();
    
    console.log("UnifiedSignalProcessor: Procesador creado con configuración:", {
      bufferSize: this.options.bufferSize,
      sampleRate: this.options.sampleRate
    });
  }
  
  /**
   * Configurar el procesador con nuevas opciones
   */
  public configure(options: UnifiedProcessorOptions): void {
    // Actualizar opciones
    this.options = {
      ...this.options,
      ...options
    };
    
    // Extraer callbacks
    if (options.onSignalReady) this.onSignalReady = options.onSignalReady;
    if (options.onError) this.onError = options.onError;
    
    console.log("UnifiedSignalProcessor: Configuración actualizada");
  }
  
  /**
   * Iniciar procesamiento
   */
  public startProcessing(): void {
    this.isProcessing = true;
    console.log("UnifiedSignalProcessor: Iniciando procesamiento");
  }
  
  /**
   * Detener procesamiento
   */
  public stopProcessing(): void {
    this.isProcessing = false;
    console.log("UnifiedSignalProcessor: Deteniendo procesamiento");
  }
  
  /**
   * Procesar un valor de señal PPG
   */
  public processSignal(value: number): ProcessedPPGSignal {
    if (!this.isProcessing) {
      console.warn("UnifiedSignalProcessor: Procesador no iniciado");
      return this.createEmptySignal(value);
    }
    
    try {
      // 1. Almacenar valor en buffer
      this.signalBuffer.push(value);
      if (this.signalBuffer.length > this.options.bufferSize) {
        this.signalBuffer.shift();
      }
      
      // 2. Aplicar filtro simple
      const filteredValue = this.applyFilter(value);
      
      // 3. Amplificar señal
      const amplifiedValue = filteredValue * this.options.amplificationFactor;
      
      // 4. Evaluar calidad
      const quality = evaluateSignalQuality(
        value, 
        filteredValue, 
        this.signalBuffer, 
        this.options.qualityThreshold
      );
      
      // 5. Detectar dedo
      const fingerDetected = quality >= this.options.qualityThreshold / 2;
      
      // 6. Detección de picos cardíacos
      const isPeak = this.detectPeak(amplifiedValue);
      
      // 7. Calcular BPM instantáneo y variabilidad
      let instantaneousBPM = 0;
      let rrInterval: number | null = null;
      
      if (isPeak) {
        const now = Date.now();
        
        if (this.lastPeakTime !== null) {
          // Calcular intervalo RR en ms
          rrInterval = now - this.lastPeakTime;
          
          // Calcular BPM
          if (rrInterval > 0) {
            instantaneousBPM = Math.round(60000 / rrInterval);
            
            // Validar BPM en rango fisiológico
            if (instantaneousBPM >= 40 && instantaneousBPM <= 180) {
              // Guardar intervalo para análisis
              this.rrIntervals.push(rrInterval);
              if (this.rrIntervals.length > 10) {
                this.rrIntervals.shift();
              }
              
              // Detectar posible arritmia
              if (this.rrIntervals.length >= 3) {
                if (this.detectArrhythmia()) {
                  this.arrhythmiaCounter++;
                }
              }
            }
          }
        }
        
        this.lastPeakTime = now;
      }
      
      // 8. Crear resultado procesado
      const processedSignal: ProcessedPPGSignal = {
        timestamp: Date.now(),
        rawValue: value,
        filteredValue,
        amplifiedValue,
        isPeak,
        instantaneousBPM,
        rrInterval,
        quality,
        fingerDetected,
        arrhythmiaCount: this.arrhythmiaCounter
      };
      
      // 9. Calcular HRV si hay suficientes intervalos
      if (this.rrIntervals.length >= 3) {
        processedSignal.heartRateVariability = this.calculateHRV();
      }
      
      // 10. Almacenar último resultado
      this._lastSignal = processedSignal;
      
      // 11. Notificar resultado
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
      
      return processedSignal;
    } catch (error) {
      console.error("UnifiedSignalProcessor: Error procesando señal:", error);
      if (this.onError) {
        this.onError(error instanceof Error ? error : new Error(String(error)));
      }
      return this.createEmptySignal(value);
    }
  }
  
  /**
   * Crear señal vacía cuando hay error
   */
  private createEmptySignal(value: number): ProcessedPPGSignal {
    return {
      timestamp: Date.now(),
      rawValue: value,
      filteredValue: value,
      amplifiedValue: value,
      isPeak: false,
      instantaneousBPM: 0,
      rrInterval: null,
      quality: 0,
      fingerDetected: false,
      arrhythmiaCount: this.arrhythmiaCounter
    };
  }
  
  /**
   * Aplicar filtrado básico
   */
  private applyFilter(value: number): number {
    if (this.signalBuffer.length < 3 || !this.options.useAdvancedFiltering) {
      return value;
    }
    
    // Filtro de media móvil simple
    const recentValues = this.signalBuffer.slice(-3);
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Mezclar valor original con filtrado para preservar características
    return 0.7 * value + 0.3 * avg;
  }
  
  /**
   * Detectar pico en señal cardíaca
   */
  private detectPeak(value: number): boolean {
    // Guardar valor para análisis
    this.peakBuffer.push(value);
    if (this.peakBuffer.length > 5) {
      this.peakBuffer.shift();
    }
    
    // Necesitamos al menos 3 valores para detectar
    if (this.peakBuffer.length < 3) {
      return false;
    }
    
    // Algoritmo simple: valor actual mayor que los 2 anteriores
    const current = this.peakBuffer[this.peakBuffer.length - 1];
    const prev1 = this.peakBuffer[this.peakBuffer.length - 2];
    const prev2 = this.peakBuffer[this.peakBuffer.length - 3];
    
    return (
      current > this.options.peakDetectionThreshold &&
      current > prev1 &&
      prev1 > prev2 &&
      // Prevenir múltiples picos muy cercanos
      (this.lastPeakTime === null || Date.now() - this.lastPeakTime > 300)
    );
  }
  
  /**
   * Detectar posible arritmia basada en intervalos RR
   */
  private detectArrhythmia(): boolean {
    if (this.rrIntervals.length < 3) return false;
    
    // Obtener últimos intervalos
    const intervals = this.rrIntervals.slice(-3);
    
    // Calcular promedio y variabilidad
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variations = intervals.map(interval => Math.abs(interval - avg) / avg);
    
    // Si hay variabilidad alta, posible arritmia
    return Math.max(...variations) > 0.2;
  }
  
  /**
   * Calcular métrica HRV (RMSSD)
   */
  private calculateHRV(): number {
    if (this.rrIntervals.length < 3) return 0;
    
    // Calcular diferencias sucesivas
    let sumSquaredDiff = 0;
    for (let i = 1; i < this.rrIntervals.length; i++) {
      const diff = this.rrIntervals[i] - this.rrIntervals[i - 1];
      sumSquaredDiff += diff * diff;
    }
    
    // Raíz cuadrada del promedio
    return Math.sqrt(sumSquaredDiff / (this.rrIntervals.length - 1));
  }
  
  /**
   * Obtener métricas de calidad de señal
   */
  public getSignalQualityMetrics(): SignalQualityMetrics {
    const quality = this._lastSignal?.quality || 0;
    
    return {
      quality,
      strength: quality * 0.8,
      stability: quality * 0.7,
      noiseLevel: Math.max(0, 100 - quality)
    };
  }
  
  /**
   * Obtener datos de intervalos RR
   */
  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    return {
      intervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime
    };
  }
  
  /**
   * Obtener contador de arritmias
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Resetear estado parcialmente
   */
  public reset(): void {
    this.signalBuffer = [];
    this.peakBuffer = [];
    this.rrIntervals = [];
    this.lastPeakTime = null;
    console.log("UnifiedSignalProcessor: Estado reseteado");
  }
  
  /**
   * Resetear estado completamente
   */
  public fullReset(): void {
    this.reset();
    this.arrhythmiaCounter = 0;
    this._lastSignal = null;
    console.log("UnifiedSignalProcessor: Estado completamente reseteado");
  }
  
  /**
   * Obtener última señal procesada
   */
  get lastSignal(): ProcessedPPGSignal | null {
    return this._lastSignal;
  }
}
