
/**
 * Procesador principal de señal PPG
 * Implementa filtrado, normalización y detección avanzada
 */

import { ProcessedPPGSignal, PPGProcessingOptions, SignalProcessingMode } from './types';
import { detectFinger, detectFingerContact } from './utils/finger-detector';
import { assessSignalQuality, evaluateSignalQuality } from './utils/quality-detector';

/**
 * Procesador avanzado de señal PPG con pipeline de procesamiento flexible
 */
export class PPGProcessor {
  // Modo de procesamiento
  private mode: SignalProcessingMode = 'standard';
  
  // Umbral de detección de dedo
  private fingerThreshold: number = 0.05;
  
  // Filtros y buffer
  private readonly MAX_BUFFER_SIZE = 100;
  private valueBuffer: number[] = [];
  private readonly SMA_WINDOW_SIZE = 15;
  private readonly LPF_ALPHA = 0.2;
  
  // Detección de dedo
  private fingerStabilityCounter: number = 0;
  private readonly STABILITY_THRESHOLD = 5;
  
  // Último resultado para cálculos diferenciales
  private lastResult: ProcessedPPGSignal | null = null;
  
  /**
   * Inicializa el procesador con opciones específicas
   */
  constructor(options: PPGProcessingOptions = {}) {
    this.configure(options);
    console.log("PPGProcessor: Inicializado con modo:", this.mode);
  }
  
  /**
   * Configura parámetros del procesador
   */
  public configure(options: PPGProcessingOptions): void {
    if (options.mode !== undefined) {
      this.mode = options.mode;
    }
    
    if (options.fingerDetectionThreshold !== undefined) {
      this.fingerThreshold = options.fingerDetectionThreshold;
    }
  }
  
  /**
   * Procesa un valor PPG raw y retorna información procesada
   */
  public processValue(value: number): ProcessedPPGSignal {
    const now = Date.now();
    
    // Actualizar buffer
    this.valueBuffer.push(value);
    if (this.valueBuffer.length > this.MAX_BUFFER_SIZE) {
      this.valueBuffer.shift();
    }
    
    // Aplicar filtros según modo
    const filteredValue = this.applyFilters(value);
    
    // Detectar presencia de dedo
    const { detected, updatedCounter } = detectFinger(
      this.valueBuffer,
      this.fingerStabilityCounter,
      {
        threshold: this.fingerThreshold,
        stabilityThreshold: this.STABILITY_THRESHOLD,
        minStdDev: 0.01,
        maxStdDev: 0.5
      }
    );
    
    this.fingerStabilityCounter = updatedCounter;
    
    // Evaluar calidad de señal
    const quality = assessSignalQuality(this.valueBuffer, detected);
    
    // Crear resultado
    const result: ProcessedPPGSignal = {
      rawValue: value,
      filteredValue,
      timestamp: now,
      quality,
      fingerDetected: detected,
      rrIntervals: this.lastResult?.rrIntervals || [],
      lastPeakTime: this.lastResult?.lastPeakTime || null,
      isPeak: false // Será actualizado por procesador de latidos
    };
    
    this.lastResult = result;
    return result;
  }
  
  /**
   * Aplica cadena de filtros basada en modo actual
   */
  private applyFilters(value: number): number {
    if (this.valueBuffer.length < 3) return value;
    
    // Aplicar filtros en cascada
    switch (this.mode) {
      case 'adaptive':
        return this.applyAdaptiveFilters(value);
      case 'highSensitivity':
        return this.applyHighSensitivityFilters(value);
      case 'lowNoise':
        return this.applyLowNoiseFilters(value);
      case 'standard':
      default:
        return this.applyStandardFilters(value);
    }
  }
  
  /**
   * Aplica filtros en modo estándar
   */
  private applyStandardFilters(value: number): number {
    // 1. Media móvil simple para eliminar ruido
    const smaWindowSize = Math.min(this.SMA_WINDOW_SIZE, this.valueBuffer.length);
    const recentValues = this.valueBuffer.slice(-smaWindowSize);
    const smaValue = recentValues.reduce((sum, val) => sum + val, 0) / smaWindowSize;
    
    // 2. Filtro pasa bajos
    const lpfValue = this.lastResult 
      ? this.lastResult.filteredValue * (1 - this.LPF_ALPHA) + smaValue * this.LPF_ALPHA
      : smaValue;
    
    return lpfValue;
  }
  
  /**
   * Aplica filtros adaptativos basados en calidad de señal
   */
  private applyAdaptiveFilters(value: number): number {
    // Determinar fuerza de filtrado basada en calidad
    let filterStrength = 0.5;
    
    if (this.lastResult) {
      // Ajustar filtro según calidad
      if (this.lastResult.quality < 30) {
        filterStrength = 0.8; // Filtrado fuerte para señales malas
      } else if (this.lastResult.quality > 70) {
        filterStrength = 0.3; // Filtrado suave para señales buenas
      }
    }
    
    // Aplicar filtrado adaptativo
    const smaWindowSize = Math.min(this.SMA_WINDOW_SIZE, this.valueBuffer.length);
    const recentValues = this.valueBuffer.slice(-smaWindowSize);
    const smaValue = recentValues.reduce((sum, val) => sum + val, 0) / smaWindowSize;
    
    // Combinar con peso adaptativo
    const adaptiveValue = this.lastResult 
      ? this.lastResult.filteredValue * filterStrength + smaValue * (1 - filterStrength)
      : smaValue;
    
    return adaptiveValue;
  }
  
  /**
   * Aplica filtros para alta sensibilidad
   */
  private applyHighSensitivityFilters(value: number): number {
    // Filtrado mínimo para preservar detalles
    const smaWindowSize = Math.min(5, this.valueBuffer.length);
    const recentValues = this.valueBuffer.slice(-smaWindowSize);
    const smaValue = recentValues.reduce((sum, val) => sum + val, 0) / smaWindowSize;
    
    return smaValue;
  }
  
  /**
   * Aplica filtros agresivos para señales ruidosas
   */
  private applyLowNoiseFilters(value: number): number {
    // 1. Media móvil de ventana amplia
    const smaWindowSize = Math.min(this.SMA_WINDOW_SIZE * 2, this.valueBuffer.length);
    const recentValues = this.valueBuffer.slice(-smaWindowSize);
    const smaValue = recentValues.reduce((sum, val) => sum + val, 0) / smaWindowSize;
    
    // 2. Filtro pasa bajos agresivo
    const lpfValue = this.lastResult 
      ? this.lastResult.filteredValue * 0.8 + smaValue * 0.2
      : smaValue;
    
    return lpfValue;
  }
  
  /**
   * Obtiene el último resultado procesado
   */
  public getLastResult(): ProcessedPPGSignal | null {
    return this.lastResult;
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.valueBuffer = [];
    this.fingerStabilityCounter = 0;
    this.lastResult = null;
  }
}
