
/**
 * Procesador avanzado de señal PPG
 * Implementa algoritmos de vanguardia para el procesamiento óptimo de la señal fotopletismográfica
 */

import { ProcessedPPGSignal, SignalProcessor, SignalProcessorConfig } from './types';
import { detectFingerContact } from './utils/finger-detector';
import { evaluateSignalQuality } from './utils/quality-detector';
import { normalizeSignal } from './utils/signal-normalizer';

export class PPGProcessor implements SignalProcessor {
  // Parámetros de configuración
  private config: SignalProcessorConfig = {
    filterParams: {
      lowPassCutoff: 5.0,        // Hz - Frecuencia de corte paso bajo
      highPassCutoff: 0.5,       // Hz - Frecuencia de corte paso alto
      smoothingFactor: 0.85      // Factor de suavizado
    },
    amplification: {
      gain: 3.5,                 // Ganancia general
      adaptiveGain: true         // Adaptación automática según calidad
    },
    fingerDetection: {
      threshold: 0.05,           // Umbral para detección de dedo
      stabilityThreshold: 0.75   // Umbral de estabilidad requerida
    }
  };

  // Estado interno del procesador
  private readonly BUFFER_SIZE = 100;
  private readonly SAMPLE_RATE = 30;  // Hz - Tasa de muestreo esperada
  private valueBuffer: number[] = [];
  private timeBuffer: number[] = [];
  private smoothedBuffer: number[] = [];
  private lastProcessedSignal: ProcessedPPGSignal | null = null;
  
  // Filtros IIR avanzados
  private lowPassFilter: LowPassFilter;
  private highPassFilter: HighPassFilter;
  private adaptiveFilter: AdaptiveNoiseFilter;
  
  // Detección avanzada de picos
  private peakDetector: PeakDetector;
  
  constructor() {
    // Inicializar filtros avanzados
    this.lowPassFilter = new LowPassFilter(this.config.filterParams.lowPassCutoff, this.SAMPLE_RATE);
    this.highPassFilter = new HighPassFilter(this.config.filterParams.highPassCutoff, this.SAMPLE_RATE);
    this.adaptiveFilter = new AdaptiveNoiseFilter(0.01, 0.98);
    
    // Inicializar detector de picos adaptativo
    this.peakDetector = new PeakDetector(0.3, 300);
    
    console.log("PPGProcessor: Inicializado con algoritmos de filtrado avanzado");
  }

  /**
   * Procesa un valor de señal PPG y aplica algoritmos avanzados de filtrado y optimización
   * @param value Valor crudo de la señal PPG
   * @param timestamp Marca de tiempo (ms) de la captura
   * @returns Señal PPG procesada con todos los parámetros calculados
   */
  public processSignal(value: number, timestamp: number = Date.now()): ProcessedPPGSignal {
    // Actualizar buffers
    this.valueBuffer.push(value);
    this.timeBuffer.push(timestamp);
    
    if (this.valueBuffer.length > this.BUFFER_SIZE) {
      this.valueBuffer.shift();
      this.timeBuffer.shift();
    }
    
    // ===== FASE 1: FILTRADO AVANZADO =====
    // Aplicar filtro paso alto para eliminar componente DC y tendencias lentas
    const highPassValue = this.highPassFilter.filter(value);
    
    // Aplicar filtro paso bajo para eliminar ruido de alta frecuencia
    const filteredValue = this.lowPassFilter.filter(highPassValue);
    
    // Aplicar filtro adaptativo para ruido variable
    const adaptiveFiltered = this.adaptiveFilter.filter(filteredValue);
    
    // ===== FASE 2: NORMALIZACIÓN Y AMPLIFICACIÓN =====
    // Normalizar señal entre 0-1 para estandarización
    const normalizedValue = normalizeSignal(adaptiveFiltered, this.valueBuffer);
    
    // Calcular factor de amplificación adaptativo según calidad
    let amplificationGain = this.config.amplification.gain;
    if (this.config.amplification.adaptiveGain) {
      // Reducir ganancia si la señal es débil o ruidosa
      const signalQuality = evaluateSignalQuality(this.valueBuffer.slice(-30));
      amplificationGain *= Math.min(1, 0.5 + signalQuality * 0.5);
    }
    
    // Amplificar señal para mejor detección de características
    const amplifiedValue = normalizedValue * amplificationGain;
    
    // ===== FASE 3: ANÁLISIS DE CALIDAD Y DETECCIONES =====
    // Detectar presencia de dedo con algoritmo avanzado
    const fingerDetected = detectFingerContact(this.valueBuffer.slice(-30), this.config.fingerDetection.threshold);
    
    // Evaluar calidad de señal
    const signalStrength = evaluateSignalQuality(this.valueBuffer.slice(-30));
    
    // Detectar picos con algoritmo adaptativo
    const isPeak = this.peakDetector.detectPeak(amplifiedValue, timestamp);
    
    // Obtener datos de RR para análisis cardíaco
    const { rrIntervals, lastPeakTime } = this.peakDetector.getRRData();
    
    // ===== FASE 4: COMPILAR RESULTADO =====
    const processedSignal: ProcessedPPGSignal = {
      timestamp,
      rawValue: value,
      filteredValue: adaptiveFiltered,
      normalizedValue,
      amplifiedValue,
      quality: signalStrength * 100, // Convertir a escala 0-100
      fingerDetected,
      signalStrength,
      metadata: {
        rrIntervals,
        lastPeakTime,
        isPeak
      }
    };
    
    this.lastProcessedSignal = processedSignal;
    return processedSignal;
  }

  /**
   * Actualiza la configuración del procesador
   */
  public setConfig(config: SignalProcessorConfig): void {
    this.config = { ...this.config, ...config };
    
    // Actualizar parámetros de filtros en tiempo real
    if (config.filterParams) {
      if (config.filterParams.lowPassCutoff) {
        this.lowPassFilter.setCutoff(config.filterParams.lowPassCutoff);
      }
      if (config.filterParams.highPassCutoff) {
        this.highPassFilter.setCutoff(config.filterParams.highPassCutoff);
      }
    }
    
    // Actualizar detector de picos
    if (config.fingerDetection) {
      if (config.fingerDetection.threshold) {
        this.peakDetector.setThreshold(config.fingerDetection.threshold);
      }
    }
  }

  /**
   * Reinicia el procesador y todos sus componentes internos
   */
  public reset(): void {
    this.valueBuffer = [];
    this.timeBuffer = [];
    this.smoothedBuffer = [];
    this.lastProcessedSignal = null;
    
    // Reiniciar estados de filtros
    this.lowPassFilter.reset();
    this.highPassFilter.reset();
    this.adaptiveFilter.reset();
    
    // Reiniciar detector de picos
    this.peakDetector.reset();
    
    console.log("PPGProcessor: Reset completo de estados");
  }
}

// ===== IMPLEMENTACIONES DE ALGORITMOS AVANZADOS =====

/**
 * Filtro paso bajo IIR avanzado
 * Elimina componentes de alta frecuencia (ruido)
 */
class LowPassFilter {
  private a: number;
  private b: number;
  private prevOutput: number = 0;
  
  constructor(cutoffFrequency: number, sampleRate: number) {
    const rc = 1.0 / (2.0 * Math.PI * cutoffFrequency);
    const dt = 1.0 / sampleRate;
    this.a = dt / (rc + dt);
    this.b = rc / (rc + dt);
  }
  
  public filter(input: number): number {
    this.prevOutput = this.a * input + this.b * this.prevOutput;
    return this.prevOutput;
  }
  
  public setCutoff(cutoffFrequency: number): void {
    const rc = 1.0 / (2.0 * Math.PI * cutoffFrequency);
    const dt = 1.0 / 30; // Mantener constante la tasa de muestreo
    this.a = dt / (rc + dt);
    this.b = rc / (rc + dt);
  }
  
  public reset(): void {
    this.prevOutput = 0;
  }
}

/**
 * Filtro paso alto IIR avanzado
 * Elimina componentes de baja frecuencia (tendencias lentas)
 */
class HighPassFilter {
  private a: number;
  private b: number;
  private prevInput: number = 0;
  private prevOutput: number = 0;
  
  constructor(cutoffFrequency: number, sampleRate: number) {
    const rc = 1.0 / (2.0 * Math.PI * cutoffFrequency);
    const dt = 1.0 / sampleRate;
    this.a = rc / (rc + dt);
    this.b = rc / (rc + dt);
  }
  
  public filter(input: number): number {
    const output = this.a * (this.prevOutput + input - this.prevInput);
    this.prevInput = input;
    this.prevOutput = output;
    return output;
  }
  
  public setCutoff(cutoffFrequency: number): void {
    const rc = 1.0 / (2.0 * Math.PI * cutoffFrequency);
    const dt = 1.0 / 30;
    this.a = rc / (rc + dt);
    this.b = rc / (rc + dt);
  }
  
  public reset(): void {
    this.prevInput = 0;
    this.prevOutput = 0;
  }
}

/**
 * Filtro adaptativo de ruido avanzado
 * Se ajusta dinámicamente al ruido presente en la señal
 */
class AdaptiveNoiseFilter {
  private learningRate: number;
  private momentum: number;
  private weights: number[] = [0, 0, 0, 0, 0];
  private inputs: number[] = [0, 0, 0, 0, 0];
  
  constructor(learningRate: number, momentum: number) {
    this.learningRate = learningRate;
    this.momentum = momentum;
  }
  
  public filter(input: number): number {
    // Actualizar buffer de entradas
    this.inputs.shift();
    this.inputs.push(input);
    
    // Aplicar filtro
    let output = 0;
    for (let i = 0; i < this.weights.length; i++) {
      output += this.weights[i] * this.inputs[i];
    }
    
    // Actualizar pesos (aprendizaje adaptativo)
    const error = input - output;
    for (let i = 0; i < this.weights.length; i++) {
      this.weights[i] = this.momentum * this.weights[i] + 
                        this.learningRate * error * this.inputs[i];
    }
    
    return output;
  }
  
  public reset(): void {
    this.weights = [0, 0, 0, 0, 0];
    this.inputs = [0, 0, 0, 0, 0];
  }
}

/**
 * Detector de picos adaptativo avanzado
 * Identifica picos en la señal PPG ajustándose a la calidad
 */
class PeakDetector {
  private threshold: number;
  private minInterval: number;
  private buffer: number[] = [];
  private readonly BUFFER_SIZE = 5;
  private lastPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private readonly MAX_RR_INTERVALS = 20;
  
  constructor(threshold: number, minInterval: number) {
    this.threshold = threshold;
    this.minInterval = minInterval;
  }
  
  public detectPeak(value: number, timestamp: number): boolean {
    // Actualizar buffer
    this.buffer.push(value);
    if (this.buffer.length > this.BUFFER_SIZE) {
      this.buffer.shift();
    }
    
    // Necesitamos al menos 3 valores para detectar un pico
    if (this.buffer.length < 3) {
      return false;
    }
    
    // Un pico es cuando el valor del medio es mayor que sus vecinos
    const isPotentialPeak = 
      this.buffer[Math.floor(this.buffer.length / 2)] > this.buffer[Math.floor(this.buffer.length / 2) - 1] &&
      this.buffer[Math.floor(this.buffer.length / 2)] > this.buffer[Math.floor(this.buffer.length / 2) + 1] &&
      this.buffer[Math.floor(this.buffer.length / 2)] > this.threshold;
    
    // Verificar tiempo mínimo desde el último pico
    const hasMinimumInterval = 
      this.lastPeakTime === null || 
      (timestamp - this.lastPeakTime) > this.minInterval;
    
    const isPeak = isPotentialPeak && hasMinimumInterval;
    
    // Si es un pico, registrarlo y calcular intervalo RR
    if (isPeak) {
      if (this.lastPeakTime !== null) {
        const interval = timestamp - this.lastPeakTime;
        this.rrIntervals.push(interval);
        if (this.rrIntervals.length > this.MAX_RR_INTERVALS) {
          this.rrIntervals.shift();
        }
      }
      this.lastPeakTime = timestamp;
    }
    
    return isPeak;
  }
  
  public getRRData(): { rrIntervals: number[], lastPeakTime: number | null } {
    return {
      rrIntervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime
    };
  }
  
  public setThreshold(threshold: number): void {
    this.threshold = threshold;
  }
  
  public reset(): void {
    this.buffer = [];
    this.lastPeakTime = null;
    this.rrIntervals = [];
  }
}

/**
 * Crea una nueva instancia del procesador de señal PPG
 */
export function createPPGProcessor(): SignalProcessor {
  return new PPGProcessor();
}
