
/**
 * Procesador de señal PPG
 * Implementa el procesamiento central de la señal fotopletismográfica
 */

import { SignalProcessor, ProcessedPPGSignal, SignalProcessorConfig } from './types';
import { detectFinger } from './utils/finger-detector';
import { assessSignalQuality } from './utils/quality-detector';
import { normalizeSignal } from './utils/signal-normalizer';

export class PPGSignalProcessor implements SignalProcessor {
  // Configuración del procesador
  private config: SignalProcessorConfig = {
    filterParams: {
      lowPassCutoff: 5, // Hz
      highPassCutoff: 0.5, // Hz
      smoothingFactor: 0.85
    },
    amplification: {
      gain: 3.5,
      adaptiveGain: true
    },
    fingerDetection: {
      threshold: 0.08,
      stabilityThreshold: 5
    }
  };
  
  // Estado del procesador
  private lastFilteredValue: number = 0;
  private signalBuffer: number[] = [];
  private readonly bufferSize: number = 50;
  private baselineValue: number = 0;
  private baselineUpdated: boolean = false;
  private qualityHistory: number[] = [];
  private readonly qualityHistorySize: number = 10;
  private stabilityCounter: number = 0;
  private lastTimestamp: number = 0;
  
  constructor() {
    console.log("PPGSignalProcessor: Instancia creada");
  }
  
  /**
   * Procesa un valor de señal PPG
   */
  public processSignal(value: number, timestamp: number = Date.now()): ProcessedPPGSignal {
    // Actualizar buffer de señal
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.bufferSize) {
      this.signalBuffer.shift();
    }
    
    // Aplicar filtro pasa-bajos para suavizar la señal
    const filteredValue = this.applyLowPassFilter(value);
    
    // Normalizar señal (centrar alrededor de cero)
    const normalizedValue = this.normalizeValue(filteredValue);
    
    // Amplificar señal
    const amplifiedValue = this.amplifySignal(normalizedValue);
    
    // Detectar presencia de dedo
    const fingerDetected = this.detectFinger(filteredValue);
    
    // Evaluar calidad de la señal
    const quality = this.evaluateSignalQuality(filteredValue, fingerDetected);
    
    // Calcular fuerza de la señal
    const signalStrength = this.calculateSignalStrength(filteredValue, quality);
    
    const result: ProcessedPPGSignal = {
      timestamp,
      rawValue: value,
      filteredValue,
      normalizedValue,
      amplifiedValue,
      quality,
      fingerDetected,
      signalStrength,
      metadata: {}
    };
    
    this.lastTimestamp = timestamp;
    
    return result;
  }
  
  /**
   * Aplica filtro pasa-bajos a la señal
   */
  private applyLowPassFilter(value: number): number {
    const alpha = this.config.filterParams?.smoothingFactor || 0.85;
    this.lastFilteredValue = alpha * this.lastFilteredValue + (1 - alpha) * value;
    return this.lastFilteredValue;
  }
  
  /**
   * Normaliza la señal respecto a una línea base
   */
  private normalizeValue(value: number): number {
    // Si el buffer tiene suficientes valores, calcular línea base
    if (this.signalBuffer.length >= 20 && !this.baselineUpdated) {
      const recentValues = this.signalBuffer.slice(-20);
      this.baselineValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      this.baselineUpdated = true;
    }
    
    // Actualizar periódicamente la línea base
    if (this.signalBuffer.length % 10 === 0) {
      const recentValues = this.signalBuffer.slice(-20);
      this.baselineValue = this.baselineValue * 0.8 + 
                          (recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length) * 0.2;
    }
    
    // Normalizar respecto a la línea base
    return value - this.baselineValue;
  }
  
  /**
   * Amplifica la señal para mejorar la detección de picos
   */
  private amplifySignal(value: number): number {
    const gain = this.config.amplification?.gain || 3.5;
    
    // Si está habilitada la ganancia adaptativa, ajustar según la variabilidad
    if (this.config.amplification?.adaptiveGain && this.signalBuffer.length >= 10) {
      const recentValues = this.signalBuffer.slice(-10);
      const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
      const stdDev = Math.sqrt(variance);
      
      // Ajustar ganancia inversamente a la desviación estándar (más estable = más ganancia)
      const adaptiveGain = stdDev < 0.1 ? 
                         gain * (1 + (0.1 - stdDev) * 10) : 
                         gain / (1 + (stdDev - 0.1) * 5);
      
      return value * adaptiveGain;
    }
    
    return value * gain;
  }
  
  /**
   * Detecta la presencia de dedo sobre la cámara
   */
  private detectFinger(value: number): boolean {
    const threshold = this.config.fingerDetection?.threshold || 0.08;
    const stabilityThreshold = this.config.fingerDetection?.stabilityThreshold || 5;
    
    // Verificar si hay suficientes muestras para evaluar
    if (this.signalBuffer.length < 10) {
      return false;
    }
    
    // Calcular estadísticas recientes
    const recentValues = this.signalBuffer.slice(-10);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Criterios de detección:
    // 1. La media debe estar por encima del umbral
    // 2. Debe haber cierta variabilidad pero no demasiada
    const condition1 = Math.abs(mean) > threshold;
    const condition2 = stdDev > 0.01 && stdDev < 0.5;
    
    if (condition1 && condition2) {
      this.stabilityCounter = Math.min(stabilityThreshold + 3, this.stabilityCounter + 1);
    } else {
      this.stabilityCounter = Math.max(0, this.stabilityCounter - 1);
    }
    
    return this.stabilityCounter >= stabilityThreshold;
  }
  
  /**
   * Evalúa la calidad de la señal (0-100)
   */
  private evaluateSignalQuality(value: number, fingerDetected: boolean): number {
    // Si no se detecta dedo, calidad cero
    if (!fingerDetected) {
      return 0;
    }
    
    let quality = 0;
    
    // Evaluar basado en variabilidad reciente
    if (this.signalBuffer.length >= 20) {
      const recentValues = this.signalBuffer.slice(-20);
      const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
      const stdDev = Math.sqrt(variance);
      
      // Calidad basada en desviación estándar (mejor entre 0.05 y 0.2)
      if (stdDev >= 0.01 && stdDev <= 0.5) {
        if (stdDev < 0.05) {
          quality = (stdDev - 0.01) / 0.04 * 50; // 0-50
        } else if (stdDev <= 0.2) {
          quality = 50 + (0.2 - stdDev) / 0.15 * 50; // 50-100
        } else {
          quality = 50 * (0.5 - stdDev) / 0.3; // 50-0
        }
      }
      
      // Valor absoluto también influye en la calidad
      const absValue = Math.abs(value);
      let amplitudeQuality = Math.min(100, absValue * 300);
      
      // Combinar métricas
      quality = quality * 0.7 + amplitudeQuality * 0.3;
    }
    
    // Almacenar calidad para suavizar los cambios
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.qualityHistorySize) {
      this.qualityHistory.shift();
    }
    
    // Suavizar cambios de calidad usando promedio móvil
    const smoothedQuality = this.qualityHistory.reduce((sum, q) => sum + q, 0) / this.qualityHistory.length;
    
    return Math.round(Math.min(100, Math.max(0, smoothedQuality)));
  }
  
  /**
   * Calcula la fuerza de la señal (0-100)
   */
  private calculateSignalStrength(value: number, quality: number): number {
    // La fuerza se basa en amplitud y calidad
    const absValue = Math.abs(value);
    const amplitudeStrength = Math.min(100, absValue * 300);
    
    // Combinar con calidad para obtener fuerza final
    return Math.round(quality * 0.7 + amplitudeStrength * 0.3);
  }
  
  /**
   * Configura parámetros del procesador
   */
  public setConfig(config: SignalProcessorConfig): void {
    this.config = {
      ...this.config,
      ...config,
      filterParams: {
        ...this.config.filterParams,
        ...config.filterParams
      },
      amplification: {
        ...this.config.amplification,
        ...config.amplification
      },
      fingerDetection: {
        ...this.config.fingerDetection,
        ...config.fingerDetection
      }
    };
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.lastFilteredValue = 0;
    this.signalBuffer = [];
    this.baselineValue = 0;
    this.baselineUpdated = false;
    this.qualityHistory = [];
    this.stabilityCounter = 0;
    this.lastTimestamp = 0;
    
    console.log("PPGSignalProcessor: Reiniciado");
  }
}

/**
 * Crea una nueva instancia del procesador de señal PPG
 */
export function createPPGSignalProcessor(): SignalProcessor {
  return new PPGSignalProcessor();
}
