/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Procesador unificado de señales PPG
 * VERSIÓN MEJORADA: Mayor sensibilidad a señales débiles
 */

import { ProcessedPPGSignal, UnifiedProcessorOptions, SignalQualityMetrics } from './types';
import { evaluateSignalQuality, calculateSignalStrength } from '../utils/quality-detector';
import { detectFingerPresence } from '../utils/finger-detector';
import { amplifySignal, normalizeSignal } from '../utils/signal-normalizer';

/**
 * Procesador unificado que maneja todo el pipeline de procesamiento de señal PPG
 * VERSIÓN MEJORADA: Detecta mejor las señales débiles
 */
export class UnifiedSignalProcessor {
  // Estado interno
  private isProcessing: boolean = true; // Iniciar como activo por defecto
  private signalBuffer: number[] = [];
  private filteredBuffer: number[] = [];
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
  
  // Contadores para diagnóstico
  private totalProcessed: number = 0;
  private peaksDetected: number = 0;
  
  /**
   * Opciones por defecto para el procesador
   */
  private static DEFAULT_OPTIONS: Required<UnifiedProcessorOptions> = {
    bufferSize: 30,
    sampleRate: 30,
    peakDetectionThreshold: 0.08, // REDUCIDO para mayor sensibilidad
    qualityThreshold: 25, // REDUCIDO para mayor sensibilidad
    amplificationFactor: 2.0, // AUMENTADO para amplificar más las señales débiles
    useAdvancedFiltering: true,
    filterStrength: 0.4, // AUMENTADO para mayor estabilidad
    peakThreshold: 0.1, // REDUCIDO para mayor sensibilidad
    minPeakDistance: 250, // REDUCIDO para permitir frecuencias cardíacas más altas
    fingerDetectionSensitivity: 0.5,
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
      sampleRate: this.options.sampleRate,
      amplificationFactor: this.options.amplificationFactor,
      filterStrength: this.options.filterStrength,
      peakDetectionThreshold: this.options.peakDetectionThreshold
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
    
    console.log("UnifiedSignalProcessor: Configuración actualizada", {
      amplificationFactor: this.options.amplificationFactor,
      filterStrength: this.options.filterStrength,
      peakDetectionThreshold: this.options.peakDetectionThreshold
    });
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
   * VERSIÓN MEJORADA: Mejor manejo de señales débiles
   */
  public processSignal(value: number): ProcessedPPGSignal {
    this.totalProcessed++;
    
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
      
      // 2. Diagnóstico rápido de señal débil
      const signalStrengthRaw = Math.abs(value);
      if (signalStrengthRaw < 0.01) {
        // Log solo cada N muestras para no saturar la consola
        if (this.totalProcessed % 10 === 0) {
          console.log("UnifiedSignalProcessor: Señal muy débil detectada", {
            valor: value,
            intensidad: signalStrengthRaw,
            muestrasTotal: this.totalProcessed,
            picosTotales: this.peaksDetected
          });
        }
      }
      
      // 3. Aplicar filtro adaptativo - Mayor fuerza para señales débiles
      const filteredValue = this.applyFilter(value);
      
      // 4. Añadir valor filtrado al buffer
      this.filteredBuffer.push(filteredValue);
      if (this.filteredBuffer.length > this.options.bufferSize) {
        this.filteredBuffer.shift();
      }
      
      // 5. Normalizar valor para análisis consistente
      const normalizedValue = normalizeSignal(filteredValue, this.filteredBuffer);
      
      // 6. Amplificar señal con factor configurado
      const amplifiedValue = amplifySignal(normalizedValue, this.options.amplificationFactor);
      
      // 7. Almacenar amplificada para detección de picos
      this.peakBuffer.push(amplifiedValue);
      if (this.peakBuffer.length > 5) {
        this.peakBuffer.shift();
      }
      
      // 8. Detección de dedo basada en patrones de señal
      const fingerDetected = detectFingerPresence(
        this.filteredBuffer,
        this.options.fingerDetectionSensitivity
      );
      
      // 9. Evaluación de calidad de señal
      const quality = evaluateSignalQuality(
        value, 
        filteredValue, 
        this.filteredBuffer, 
        this.options.qualityThreshold
      );
      
      // 10. Calcular fuerza de la señal
      const signalStrength = calculateSignalStrength(this.filteredBuffer);
      
      // 11. Detección de pico cardíaco - MÁS SENSIBLE
      const isPeak = this.detectPeak(amplifiedValue);
      const peakConfidence = isPeak ? Math.min(quality / 100, 0.9) : 0;
      
      if (isPeak) {
        this.peaksDetected++;
      }
      
      // 12. Cálculo de BPM e intervalo RR
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
            
            // Validar BPM en rango fisiológico más amplio (para más sensibilidad)
            if (instantaneousBPM >= 35 && instantaneousBPM <= 200) {
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
              
              // Diagnóstico de BPM
              console.log("UnifiedSignalProcessor: Pico cardíaco detectado", {
                bpmInstantáneo: instantaneousBPM,
                intervaloRR: rrInterval,
                confianza: peakConfidence,
                calidad: quality
              });
            } else {
              console.log("UnifiedSignalProcessor: BPM fuera de rango fisiológico:", instantaneousBPM);
            }
          }
        }
        
        this.lastPeakTime = now;
      }
      
      // 13. Crear resultado procesado
      const processedSignal: ProcessedPPGSignal = {
        timestamp: Date.now(),
        rawValue: value,
        filteredValue,
        normalizedValue,
        amplifiedValue,
        isPeak,
        peakConfidence,
        instantaneousBPM,
        rrInterval,
        quality,
        fingerDetected,
        signalStrength,
        arrhythmiaCount: this.arrhythmiaCounter
      };
      
      // 14. Calcular HRV si hay suficientes intervalos
      if (this.rrIntervals.length >= 3) {
        processedSignal.heartRateVariability = this.calculateHRV();
      }
      
      // 15. Diagnóstico para señales de calidad pero sin picos
      if (quality > 50 && fingerDetected && !isPeak) {
        // Registrar solo ocasionalmente para no saturar la consola
        if (this.totalProcessed % 30 === 0) {
          console.log("UnifiedSignalProcessor: Calidad buena pero sin picos", {
            calidad: quality,
            dedoDetectado: fingerDetected,
            valorBruto: value,
            valorAmplificado: amplifiedValue,
            umbralPico: this.options.peakDetectionThreshold,
            fuerzaSeñal: signalStrength
          });
        }
      }
      
      // 16. Almacenar último resultado
      this._lastSignal = processedSignal;
      
      // 17. Notificar resultado
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
   * Detecta un pico cardíaco en la señal
   * VERSIÓN MEJORADA: Más sensible a señales débiles
   */
  private detectPeak(value: number): boolean {
    if (this.peakBuffer.length < 3) return false;
    
    // Algoritmo simple: detectar si el valor actual es mayor que los 2 anteriores
    // y supera el umbral mínimo
    const current = this.peakBuffer[this.peakBuffer.length - 1];
    const prev1 = this.peakBuffer[this.peakBuffer.length - 2];
    const prev2 = this.peakBuffer[this.peakBuffer.length - 3];
    
    // Comprobar si hay un pico
    const isPeak = current > this.options.peakDetectionThreshold && 
                   current > prev1 * 1.05 && // Reducido el factor de diferencia
                   prev1 >= prev2 &&
                   // Prevenir múltiples picos muy cercanos
                   (this.lastPeakTime === null || 
                    Date.now() - this.lastPeakTime > this.options.minPeakDistance);
    
    return isPeak;
  }
  
  /**
   * Normalizar valor para procesamiento uniforme
   */
  private normalizeValue(value: number): number {
    // Implementación simple: asegurar que está en rango [0,1]
    return value > 1 ? value / 255 : value;
  }
  
  /**
   * Crear señal vacía cuando hay error
   */
  private createEmptySignal(value: number): ProcessedPPGSignal {
    return {
      timestamp: Date.now(),
      rawValue: value,
      filteredValue: value,
      normalizedValue: value,
      amplifiedValue: value,
      isPeak: false,
      peakConfidence: 0,
      instantaneousBPM: 0,
      rrInterval: null,
      quality: 0,
      fingerDetected: false,
      signalStrength: 0,
      arrhythmiaCount: this.arrhythmiaCounter
    };
  }
  
  /**
   * Aplica filtrado básico
   * VERSIÓN MEJORADA: Mejor filtrado para señales débiles
   */
  private applyFilter(value: number): number {
    if (this.signalBuffer.length < 3 || !this.options.useAdvancedFiltering) {
      return value;
    }
    
    // Para señales muy débiles, usar filtrado más suave
    if (Math.abs(value) < 0.01) {
      const recentValues = this.signalBuffer.slice(-4);
      const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      
      // Mezcla con mayor peso del valor original para preservar detalles en señales débiles
      return 0.8 * value + 0.2 * avg;
    }
    
    // Filtro de media móvil simple
    const recentValues = this.signalBuffer.slice(-3);
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Mezclar valor original con filtrado para preservar características
    const filterWeight = this.options.filterStrength;
    return (1 - filterWeight) * value + filterWeight * avg;
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
    this.filteredBuffer = [];
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
    this.totalProcessed = 0;
    this.peaksDetected = 0;
    console.log("UnifiedSignalProcessor: Estado completamente reseteado");
  }
  
  /**
   * Obtener última señal procesada
   */
  get lastSignal(): ProcessedPPGSignal | null {
    return this._lastSignal;
  }
}
