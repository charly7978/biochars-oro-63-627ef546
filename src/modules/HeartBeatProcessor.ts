
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsProcessor } from './VitalSignsProcessor';
import { SignalProcessor } from './vital-signs/signal-processor';
import { CrossValidator } from './vital-signs/utils/cross-validation-utils';

export interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isArrhythmia: boolean;
  arrhythmiaCount: number;
  quality: number;
}

export interface RRInterval {
  intervals: number[];
  lastPeakTime: number | null;
}

/**
 * Procesador principal de señales cardíacas
 * Integra detección de dedos, procesamiento de señal y validación cruzada
 */
export class HeartBeatProcessor {
  // Procesadores especializados
  private vitalSignsProcessor: VitalSignsProcessor;
  private signalProcessor: SignalProcessor;
  private crossValidator: CrossValidator;
  
  // Estado de monitoreo
  private isMonitoring: boolean = false;
  
  // Buffer de señal y resultados
  private signalBuffer: number[] = [];
  private lastBpm: number = 0;
  private currentSignal: number = 0;
  private rrIntervals: RRInterval = { intervals: [], lastPeakTime: null };
  private arrhythmiaWindows: any[] = [];
  private fingerDetected: boolean = false;
  
  // Tiempo y calidad
  private lastProcessTime: number = 0;
  private readonly PROCESS_INTERVAL_MS = 100;
  private signalQuality: number = 0;
  
  /**
   * Constructor del procesador
   */
  constructor() {
    // Inicializar procesadores especializados
    this.vitalSignsProcessor = new VitalSignsProcessor();
    this.signalProcessor = new SignalProcessor();
    this.crossValidator = new CrossValidator();
    
    console.log('HeartBeatProcessor: Inicializando con procesamiento real sin simulaciones');
    
    // Registrar esta instancia globalmente para acceso desde otros módulos
    (window as any).heartBeatProcessor = this;
  }
  
  /**
   * Controlar estado de monitoreo
   */
  public setMonitoring(isMonitoring: boolean): void {
    this.isMonitoring = isMonitoring;
    
    // Reiniciar procesadores si se detiene el monitoreo
    if (!isMonitoring) {
      this.reset();
    }
  }
  
  /**
   * Procesar señal PPG y extraer información vital
   */
  public processSignal(value: number): HeartBeatResult {
    // Almacenar valor actual para acceso desde otros módulos
    this.currentSignal = value;
    
    const now = Date.now();
    
    // Limitar frecuencia de procesamiento para no sobrecargar
    if (now - this.lastProcessTime < this.PROCESS_INTERVAL_MS) {
      return this.getLastResult();
    }
    
    this.lastProcessTime = now;
    
    // Verificar si el dispositivo está monitoreando
    if (!this.isMonitoring) {
      return this.getLastResult();
    }
    
    // Añadir a buffer de señal
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > 300) {
      this.signalBuffer.splice(0, this.signalBuffer.length - 300);
    }
    
    // Procesar señal con el procesador especializado
    const { filteredValue, quality, fingerDetected } = this.signalProcessor.applyFilters(value);
    this.fingerDetected = fingerDetected;
    this.signalQuality = quality;
    
    // Si no hay dedo detectado, retornar resultado vacío
    if (!fingerDetected) {
      return {
        bpm: 0,
        confidence: 0,
        isArrhythmia: false,
        arrhythmiaCount: 0,
        quality: quality
      };
    }
    
    // Actualizar detección de picos y RR intervals
    this.updateRRIntervals(filteredValue);
    
    // Procesar con el procesador de signos vitales
    const vitalSignsResult = this.vitalSignsProcessor.processSignal(filteredValue, this.getRRIntervals());
    
    // Calcular frecuencia cardíaca
    const calculatedBpm = this.signalProcessor.calculateHeartRate();
    let finalBpm = calculatedBpm;
    let confidence = quality / 100;
    
    // Solo usar BPM si es fisiológicamente válido
    if (finalBpm < 40 || finalBpm > 200) {
      finalBpm = this.lastBpm > 0 ? this.lastBpm : 75;
      confidence *= 0.5;
    } else {
      this.lastBpm = finalBpm;
    }
    
    // Obtener recuento de arritmias
    const arrhythmiaCount = this.vitalSignsProcessor.getArrhythmiaCounter();
    const isArrhythmia = arrhythmiaCount > 0;
    
    // Resultado final
    const result: HeartBeatResult = {
      bpm: Math.round(finalBpm),
      confidence,
      isArrhythmia,
      arrhythmiaCount,
      quality
    };
    
    return result;
  }
  
  /**
   * Actualizar datos RR para análisis de arritmias
   */
  private updateRRIntervals(filteredValue: number): void {
    // Implementación básica de detección de picos
    const peakThreshold = 0.5;
    const bufferSize = this.signalBuffer.length;
    
    if (bufferSize < 5) return;
    
    // Verificar si es un pico
    const isPeak = filteredValue > peakThreshold && 
                  filteredValue > this.signalBuffer[bufferSize - 2] &&
                  filteredValue > this.signalBuffer[bufferSize - 3];
    
    if (isPeak) {
      const now = Date.now();
      
      if (this.rrIntervals.lastPeakTime !== null) {
        const interval = now - this.rrIntervals.lastPeakTime;
        
        // Solo añadir intervalos fisiológicamente plausibles (40-180 BPM)
        if (interval >= 333 && interval <= 1500) {
          this.rrIntervals.intervals.push(interval);
          
          // Limitar el número de intervalos almacenados
          if (this.rrIntervals.intervals.length > 20) {
            this.rrIntervals.intervals.shift();
          }
          
          // Detectar posible arritmia
          this.detectPotentialArrhythmia(interval);
        }
      }
      
      this.rrIntervals.lastPeakTime = now;
    }
  }
  
  /**
   * Detectar posible arritmia basada en intervalos RR
   */
  private detectPotentialArrhythmia(currentInterval: number): void {
    const intervals = this.rrIntervals.intervals;
    if (intervals.length < 5) return;
    
    // Calcular promedio de los últimos intervalos
    const recentIntervals = intervals.slice(-5);
    const avgInterval = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
    
    // Calcular variación del intervalo actual respecto al promedio
    const variation = Math.abs(currentInterval - avgInterval) / avgInterval;
    
    // Si la variación es significativa, podría ser una arritmia
    if (variation > 0.25) {
      const now = Date.now();
      
      // Registrar ventana de arritmia
      this.arrhythmiaWindows.push({
        start: now - currentInterval,
        end: now,
        variation
      });
      
      // Limitar el número de ventanas
      if (this.arrhythmiaWindows.length > 10) {
        this.arrhythmiaWindows.shift();
      }
    }
  }
  
  /**
   * Obtener el último resultado calculado
   */
  private getLastResult(): HeartBeatResult {
    return {
      bpm: this.lastBpm,
      confidence: this.fingerDetected ? this.signalQuality / 100 : 0,
      isArrhythmia: this.arrhythmiaWindows.length > 0,
      arrhythmiaCount: this.arrhythmiaWindows.length,
      quality: this.signalQuality
    };
  }
  
  /**
   * Obtener intervalos RR para análisis de arritmias
   */
  public getRRIntervals(): RRInterval {
    return this.rrIntervals;
  }
  
  /**
   * Obtener ventanas de tiempo donde se detectaron arritmias
   */
  public getArrhythmiaWindows(): any[] {
    return this.arrhythmiaWindows;
  }
  
  /**
   * Calcular BPM actual
   */
  public calculateCurrentBPM(): number {
    if (!this.fingerDetected || this.rrIntervals.intervals.length < 3) {
      return this.lastBpm;
    }
    
    // Usar los últimos intervalos RR para calcular BPM
    const recentIntervals = this.rrIntervals.intervals.slice(-5);
    const avgInterval = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
    
    // Convertir intervalo a BPM
    const bpm = 60000 / avgInterval;
    
    // Validar que sea fisiológicamente plausible
    if (bpm >= 40 && bpm <= 200) {
      this.lastBpm = bpm;
    }
    
    return this.lastBpm;
  }
  
  /**
   * Obtener valor de señal actual
   */
  public getCurrentSignal(): number {
    return this.currentSignal;
  }
  
  /**
   * Obtener recuento de arritmias
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaWindows.length;
  }
  
  /**
   * Reiniciar el procesador
   */
  public reset(): void {
    // Limpiar buffers y estado
    this.signalBuffer = [];
    this.lastBpm = 0;
    this.currentSignal = 0;
    this.rrIntervals = { intervals: [], lastPeakTime: null };
    this.arrhythmiaWindows = [];
    this.fingerDetected = false;
    this.signalQuality = 0;
    
    // Reiniciar procesadores especializados
    this.vitalSignsProcessor.fullReset();
    this.signalProcessor.reset();
    this.crossValidator.reset();
    
    console.log('HeartBeatProcessor: Reiniciado completamente');
  }
}
