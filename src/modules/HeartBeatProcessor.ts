
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
  isPeak?: boolean;
  rrData?: {
    intervals: number[];
    lastPeakTime: number | null;
  };
  filteredValue?: number;
  transition?: {
    active: boolean;
    progress: number;
    direction: string;
  };
}

export interface RRInterval {
  intervals: number[];
  lastPeakTime: number | null;
}

/**
 * Procesador principal de señales cardíacas
 * SOLO PROCESAMIENTO DIRECTO DE SEÑALES REALES
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
  private readonly PROCESS_INTERVAL_MS = 50; // Más rápido para mejor respuesta
  private signalQuality: number = 0;
  
  // Detección de picos mejorada
  private lastPeakTime: number = 0;
  private minPeakDistance: number = 300; // mínimo 300ms entre picos (200 BPM máximo)
  private lastFilteredValues: number[] = [];
  private peakThreshold: number = 0.4;
  
  /**
   * Constructor del procesador
   * Inicializa todos los procesadores para medición DIRECTA
   */
  constructor() {
    // Inicializar procesadores especializados para medición DIRECTA
    this.vitalSignsProcessor = new VitalSignsProcessor();
    this.signalProcessor = new SignalProcessor();
    this.crossValidator = new CrossValidator();
    
    console.log('HeartBeatProcessor: Inicializando con procesamiento REAL directo sin simulaciones');
    
    // Precargar buffer con valores neutros
    this.lastFilteredValues = Array(10).fill(0);
  }
  
  /**
   * Controlar estado de monitoreo
   * Sólo activa el procesamiento real, nunca usa simulación
   */
  public setMonitoring(isMonitoring: boolean): void {
    this.isMonitoring = isMonitoring;
    
    console.log('HeartBeatProcessor: Estado de monitoreo cambiado a', isMonitoring, 'MODO MEDICIÓN DIRECTA');
    
    // Reiniciar procesadores si se detiene el monitoreo
    if (!isMonitoring) {
      this.reset();
    }
  }
  
  /**
   * Procesar señal PPG y extraer información vital
   * SÓLO procesamiento REAL, sin simulación
   */
  public processSignal(value: number): HeartBeatResult {
    // Almacenar valor actual para acceso desde otros módulos
    this.currentSignal = value;
    
    const now = Date.now();
    
    // Limitar frecuencia de procesamiento para no sobrecargar
    if (now - this.lastProcessTime < this.PROCESS_INTERVAL_MS) {
      const lastResult = this.getLastResult();
      console.log("Reutilizando último resultado por limitación de frecuencia", {
        value,
        lastResult: { bpm: lastResult.bpm, quality: lastResult.quality }
      });
      return lastResult;
    }
    
    this.lastProcessTime = now;
    
    // Verificar si el dispositivo está monitoreando
    if (!this.isMonitoring) {
      console.log("No está monitoreando, devolviendo último resultado", {
        isMonitoring: this.isMonitoring
      });
      return this.getLastResult();
    }
    
    console.log("Procesando señal REAL:", { value });
    
    // Añadir a buffer de señal
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > 300) {
      this.signalBuffer.splice(0, this.signalBuffer.length - 300);
    }
    
    // Procesar señal con el procesador especializado - MEDICIÓN DIRECTA
    const { filteredValue, quality, fingerDetected } = this.signalProcessor.applyFilters(value);
    this.fingerDetected = fingerDetected;
    this.signalQuality = quality;
    
    console.log("Señal filtrada:", { 
      original: value, 
      filtrada: filteredValue, 
      calidad: quality, 
      dedoDetectado: fingerDetected 
    });
    
    // Actualizar el buffer de valores filtrados
    this.lastFilteredValues.push(filteredValue);
    if (this.lastFilteredValues.length > 10) {
      this.lastFilteredValues.shift();
    }
    
    // Si no hay dedo detectado, devolver resultado con valores reales pero calidad baja
    if (!fingerDetected) {
      console.log("Dedo no detectado, retornando resultado vacío");
      return {
        bpm: 0,
        confidence: 0,
        isArrhythmia: false,
        arrhythmiaCount: 0,
        quality: quality,
        isPeak: false,
        rrData: this.rrIntervals,
        filteredValue: filteredValue,
        transition: {
          active: false,
          progress: 0,
          direction: 'none'
        }
      };
    }
    
    // Mejorar detección de picos para señales reales
    const isPeak = this.detectPeak(filteredValue, now);
    
    // Actualizar RR intervals basados en picos reales
    if (isPeak) {
      this.updateRRIntervalsFromPeak(now);
    }
    
    // Procesar con el procesador de signos vitales usando datos reales
    const vitalSignsResult = this.vitalSignsProcessor.processSignal(filteredValue, this.getRRIntervals());
    
    // Calcular frecuencia cardíaca directamente de los intervalos RR
    let calculatedBpm = this.calculateBpmFromRR();
    
    // Si no tenemos suficientes intervalos RR, usar cálculo del procesador
    if (calculatedBpm === 0) {
      calculatedBpm = this.signalProcessor.calculateHeartRate();
    }
    
    // Validación de frecuencia cardíaca para resultados reales
    let finalBpm = calculatedBpm;
    let confidence = quality / 100;
    
    // Solo usar BPM si es fisiológicamente válido
    if (finalBpm < 40 || finalBpm > 200) {
      finalBpm = this.lastBpm > 0 ? this.lastBpm : 0; // Preferimos 0 a un valor inventado
      confidence *= 0.5;
      console.log("BPM fuera de rango fisiológico:", calculatedBpm);
    } else {
      this.lastBpm = finalBpm;
      console.log("BPM calculado:", finalBpm);
    }
    
    // Obtener recuento de arritmias reales
    const arrhythmiaCount = this.vitalSignsProcessor.getArrhythmiaCounter();
    const isArrhythmia = arrhythmiaCount > 0;
    
    // Resultado final con datos reales
    const result: HeartBeatResult = {
      bpm: Math.round(finalBpm),
      confidence,
      isArrhythmia,
      arrhythmiaCount,
      quality,
      isPeak,
      rrData: this.getRRIntervals(),
      filteredValue,
      transition: {
        active: false,
        progress: 0,
        direction: 'none'
      }
    };
    
    console.log("Resultado final:", { 
      bpm: result.bpm, 
      calidad: result.quality, 
      confianza: result.confidence 
    });
    
    return result;
  }
  
  /**
   * Detecta picos en la señal PPG filtrada
   * Algoritmo mejorado para señales reales
   */
  private detectPeak(filteredValue: number, timestamp: number): boolean {
    // Verificar distancia temporal mínima desde el último pico
    if (timestamp - this.lastPeakTime < this.minPeakDistance) {
      return false;
    }
    
    // Necesitamos al menos 3 valores para detectar un pico
    if (this.lastFilteredValues.length < 3) {
      return false;
    }
    
    // Calcular el valor máximo y mínimo reciente para adaptar el umbral
    const recentValues = [...this.lastFilteredValues, filteredValue];
    const maxValue = Math.max(...recentValues);
    const minValue = Math.min(...recentValues);
    const range = maxValue - minValue;
    
    // Umbral adaptativo basado en el rango de la señal
    const adaptiveThreshold = this.peakThreshold * range;
    
    // Verificar si este punto es un pico comparando con los valores previos
    const isPeak = filteredValue > this.lastFilteredValues[this.lastFilteredValues.length - 1] &&
                  filteredValue > this.lastFilteredValues[this.lastFilteredValues.length - 2] &&
                  filteredValue - minValue > adaptiveThreshold;
    
    // Si es un pico, actualizar el tiempo del último pico
    if (isPeak) {
      this.lastPeakTime = timestamp;
      console.log("Pico detectado en señal real:", { 
        timestamp, 
        filteredValue, 
        adaptiveThreshold 
      });
    }
    
    return isPeak;
  }
  
  /**
   * Actualizar intervalos RR cuando se detecta un pico
   * Usa timestamps reales para precisión máxima
   */
  private updateRRIntervalsFromPeak(timestamp: number): void {
    if (this.rrIntervals.lastPeakTime !== null) {
      const interval = timestamp - this.rrIntervals.lastPeakTime;
      
      // Solo añadir intervalos fisiológicamente plausibles (40-200 BPM)
      if (interval >= 300 && interval <= 1500) {
        this.rrIntervals.intervals.push(interval);
        
        // Limitar el número de intervalos almacenados
        if (this.rrIntervals.intervals.length > 20) {
          this.rrIntervals.intervals.shift();
        }
        
        // Detectar posible arritmia
        this.detectArrhythmia(interval, timestamp);
        
        console.log("Intervalo RR actualizado:", { 
          interval, 
          intervalCount: this.rrIntervals.intervals.length 
        });
      } else {
        console.log("Intervalo RR descartado por fuera de rango:", interval);
      }
    }
    
    this.rrIntervals.lastPeakTime = timestamp;
  }
  
  /**
   * Detectar posible arritmia basada en intervalos RR reales
   */
  private detectArrhythmia(currentInterval: number, timestamp: number): void {
    const intervals = this.rrIntervals.intervals;
    if (intervals.length < 5) return;
    
    // Calcular promedio de los últimos intervalos
    const recentIntervals = intervals.slice(-5);
    const avgInterval = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
    
    // Calcular variación del intervalo actual respecto al promedio
    const variation = Math.abs(currentInterval - avgInterval) / avgInterval;
    
    // Umbrales de detección de arritmia ajustados para señales reales
    const arrhythmiaThreshold = 0.2;
    
    // Si la variación es significativa, podría ser una arritmia
    if (variation > arrhythmiaThreshold) {
      console.log("Posible arritmia detectada:", { 
        variación: variation, 
        umbral: arrhythmiaThreshold,
        intervaloActual: currentInterval,
        intervaloPromedio: avgInterval
      });
      
      // Registrar ventana de arritmia
      this.arrhythmiaWindows.push({
        start: timestamp - currentInterval,
        end: timestamp,
        variation
      });
      
      // Limitar el número de ventanas
      if (this.arrhythmiaWindows.length > 10) {
        this.arrhythmiaWindows.shift();
      }
    }
  }
  
  /**
   * Calcular BPM directamente de los intervalos RR
   * Mayor precisión para medición real
   */
  private calculateBpmFromRR(): number {
    if (this.rrIntervals.intervals.length < 3) {
      return 0; // Insuficientes datos
    }
    
    // Usar los últimos intervalos para mayor precisión
    const recentIntervals = this.rrIntervals.intervals.slice(-5);
    
    // Descartar valores extremos
    recentIntervals.sort((a, b) => a - b);
    const filteredIntervals = recentIntervals.slice(1, -1); // Eliminar el menor y mayor valor
    
    if (filteredIntervals.length === 0) {
      return 0;
    }
    
    // Calcular promedio de intervalos filtrados
    const avgInterval = filteredIntervals.reduce((sum, val) => sum + val, 0) / filteredIntervals.length;
    
    // Convertir a BPM
    const bpm = 60000 / avgInterval;
    
    console.log("BPM calculado desde RR:", { 
      bpm, 
      avgInterval, 
      intervalCount: filteredIntervals.length 
    });
    
    return bpm;
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
      quality: this.signalQuality,
      isPeak: false,
      rrData: this.getRRIntervals(),
      filteredValue: this.currentSignal,
      transition: {
        active: false,
        progress: 0,
        direction: 'none'
      }
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
   * Usa datos reales
   */
  public calculateCurrentBPM(): number {
    return this.calculateBpmFromRR();
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
   * Elimina todos los datos almacenados
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
    this.lastFilteredValues = Array(10).fill(0);
    this.lastPeakTime = 0;
    
    // Reiniciar procesadores especializados
    this.vitalSignsProcessor.fullReset();
    this.signalProcessor.reset();
    this.crossValidator.reset();
    
    console.log('HeartBeatProcessor: Reiniciado completamente para medición directa');
  }
}
