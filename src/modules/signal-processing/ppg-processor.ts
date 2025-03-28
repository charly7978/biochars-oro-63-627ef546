
/**
 * Procesador de señal PPG
 * Extrae, filtra y normaliza señales PPG
 */

import { ProcessedPPGSignal } from './types';
import { SignalProcessor } from './types';

export class PPGProcessor implements SignalProcessor {
  private buffer: number[] = [];
  private bufferSize = 50;
  private initialized = false;
  private lastRawValue = 0;
  private lastNormalizedValue = 0;
  private signalQualityEstimate = 0;
  private fingerDetected = false;
  
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
   * Procesa un valor de entrada y produce una señal PPG procesada
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
    
    // Detectar presencia de dedo (señal significativa)
    this.detectFinger(input);
    
    // Calcular calidad de señal
    this.calculateSignalQuality();
    
    // Normalizar valor
    const normalizedValue = this.normalizeValue(input);
    
    // Amplificar valor si es necesario
    const amplifiedValue = this.amplifyValue(normalizedValue);
    
    // Filtrar señal
    const filteredValue = this.filterValue(amplifiedValue);
    
    // Crear resultado
    const result: ProcessedPPGSignal = {
      timestamp: Date.now(),
      rawValue: input,
      normalizedValue: normalizedValue,
      amplifiedValue: amplifiedValue,
      filteredValue: filteredValue,
      quality: this.signalQualityEstimate,
      fingerDetected: this.fingerDetected,
      signalStrength: this.calculateSignalStrength(input),
      isPeak: false // Se establecerá en otro procesador
    };
    
    // Actualizar últimos valores
    this.lastRawValue = input;
    this.lastNormalizedValue = normalizedValue;
    
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
    this.initialized = false;
    this.lastRawValue = 0;
    this.lastNormalizedValue = 0;
    this.signalQualityEstimate = 0;
    this.fingerDetected = false;
  }
  
  /**
   * Calibrar el procesador con valores de referencia
   */
  public calibrate(referenceValues: number[]): void {
    if (referenceValues && referenceValues.length > 0) {
      // Usar valores de referencia para mejorar normalización
      const min = Math.min(...referenceValues);
      const max = Math.max(...referenceValues);
      const range = max - min;
      
      // Actualizar buffer con valores calibrados
      this.buffer = referenceValues.slice(-this.bufferSize);
    }
  }
  
  /**
   * Detecta si hay un dedo presente basado en la señal
   */
  private detectFinger(value: number): void {
    if (this.buffer.length < 10) {
      this.fingerDetected = value > 0.1; // Umbral mínimo
      return;
    }
    
    // Calcular variación de señal
    const recentValues = this.buffer.slice(-10);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    
    // Hay dedo si hay señal significativa con cierta variación
    this.fingerDetected = mean > 0.1 && variance > 0.0001 && variance < 0.1;
  }
  
  /**
   * Calcula la calidad estimada de la señal [0-100]
   */
  private calculateSignalQuality(): void {
    if (this.buffer.length < 10 || !this.fingerDetected) {
      this.signalQualityEstimate = 0;
      return;
    }
    
    // Factores que afectan calidad
    const recentValues = this.buffer.slice(-10);
    
    // 1. Variabilidad adecuada (ni muy alta ni muy baja)
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    const cv = Math.sqrt(variance) / mean; // Coeficiente de variación
    
    // Calidad óptima en rangos adecuados de variación
    let variabilityScore = 0;
    if (cv > 0.05 && cv < 0.5) {
      variabilityScore = 100 - Math.abs((cv - 0.2) * 200);
    }
    
    // 2. Amplitud suficiente
    const range = Math.max(...recentValues) - Math.min(...recentValues);
    const amplitudeScore = Math.min(100, range * 200);
    
    // 3. Continuidad (sin saltos bruscos)
    const deltas = [];
    for (let i = 1; i < recentValues.length; i++) {
      deltas.push(Math.abs(recentValues[i] - recentValues[i-1]));
    }
    const maxDelta = Math.max(...deltas);
    const continuityScore = 100 - Math.min(100, maxDelta * 200);
    
    // Calidad combinada
    this.signalQualityEstimate = Math.round(
      variabilityScore * 0.4 + 
      amplitudeScore * 0.3 + 
      continuityScore * 0.3
    );
    
    // Asegurar rango 0-100
    this.signalQualityEstimate = Math.max(0, Math.min(100, this.signalQualityEstimate));
  }
  
  /**
   * Normaliza el valor de entrada [0-1]
   */
  private normalizeValue(value: number): number {
    // Si el buffer está vacío, normalización simple
    if (this.buffer.length < 5) {
      return Math.max(0, Math.min(1, value));
    }
    
    // Normalizar con min-max del buffer reciente
    const min = Math.min(...this.buffer);
    const max = Math.max(...this.buffer);
    
    // Evitar división por cero
    if (max === min) return 0.5;
    
    // Normalizar a 0-1
    return (value - min) / (max - min);
  }
  
  /**
   * Amplifica el valor normalizado para resaltar cambios
   */
  private amplifyValue(value: number): number {
    // Amplificar señal débil
    if (value < 0.3) {
      return value * 1.5;
    }
    
    // Mantener señal media
    if (value < 0.7) {
      return value;
    }
    
    // Comprimir señal fuerte
    return 0.7 + (value - 0.7) * 0.7;
  }
  
  /**
   * Filtra el valor para reducir ruido
   */
  private filterValue(value: number): number {
    // Si no hay suficiente historial, devolver sin cambios
    if (this.buffer.length < 3) {
      return value;
    }
    
    // Filtro paso-bajo simple (promedio móvil)
    const recentValues = this.buffer.slice(-3);
    const average = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Mezclar valor actual con promedio (suavizado)
    const filterStrength = 0.3; // 0-1 (mayor = más suavizado)
    return value * (1 - filterStrength) + average * filterStrength;
  }
  
  /**
   * Calcula la intensidad de la señal [0-100]
   */
  private calculateSignalStrength(value: number): number {
    // Algoritmo simple: usar amplitud
    const recentValues = this.buffer.slice(-10);
    
    if (recentValues.length < 3) {
      return value > 0.1 ? 50 : 0;
    }
    
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;
    
    // Convertir a porcentaje
    return Math.min(100, range * 100 * 5);
  }
}
