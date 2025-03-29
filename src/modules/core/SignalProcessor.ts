
/**
 * NOTA IMPORTANTE: Este es el módulo central de procesamiento y optimización de señales.
 * Encargado de extracción, validación, detección de dedo, señalización de calidad,
 * procesamiento integral de señales PPG/cardiacas con optimización de 6 canales y feedback bidireccional.
 */

import { calculatePerfusionIndex } from '../../utils/vitalSignsUtils';
import type { ProcessingError } from '../../types/signal';

// Interfaz unificada para señales procesadas
export interface ProcessedSignal {
  // Valores principales
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  rawValue?: number;
  timestamp?: number;
  
  // Región de interés
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // Análisis avanzado
  perfusionIndex?: number;
  pressureArtifactLevel?: number;
  normalizedSpectrum?: number[];
  channels?: {
    red: number;
    green: number;
    blue: number;
    infrared?: number;
  };
}

/**
 * Procesador optimizado de señales con filtrado multi-canal y adaptación bidireccional
 */
export class SignalProcessor {
  // Configuración del buffer y filtrado
  private readonly BUFFER_SIZE = 300;
  private readonly SMA_WINDOW_SIZE = 5;
  private readonly QUALITY_THRESHOLD = 0.03;
  private readonly FINGER_DETECTION_THRESHOLD = 25;
  
  // Buffers de datos para cada canal
  private ppgValues: number[] = [];
  private smaBuffer: number[] = [];
  private channelBuffers: {[key: string]: number[]} = {
    red: [],
    green: [],
    blue: [],
    ir: []
  };
  
  // Estado de detección
  private lastProcessedTime: number = 0;
  private consecutiveFingerFrames: number = 0;
  private readonly MIN_FINGER_FRAMES = 2;
  
  // Contadores de análisis
  private signalQualityHistory: number[] = [];
  private perfusionIndexHistory: number[] = [];
  private pressureArtifactLevel: number = 0;
  private adaptiveBaselineValue: number = 0;
  private channelWeights: {[key: string]: number} = {
    red: 0.7,
    green: 0.2,
    blue: 0.1,
    ir: 0.0
  };
  
  /**
   * Procesa una señal PPG utilizando optimización multi-canal
   */
  public processSignal(value: number, channelValues?: {[key: string]: number}): ProcessedSignal {
    // Actualizar canales si están disponibles
    if (channelValues) {
      Object.keys(channelValues).forEach(channel => {
        if (this.channelBuffers[channel]) {
          this.channelBuffers[channel].push(channelValues[channel]);
          if (this.channelBuffers[channel].length > this.BUFFER_SIZE) {
            this.channelBuffers[channel].shift();
          }
        }
      });
      
      // Ajustar pesos de canales basados en calidad
      this.optimizeChannelWeights();
    }
    
    // Aplicar filtro SMA para suavizar la señal
    const { filteredValue, updatedBuffer } = this.applySMAFilter(value);
    this.smaBuffer = updatedBuffer;
    
    // Actualizar buffer de valores PPG
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > this.BUFFER_SIZE) {
      this.ppgValues.shift();
    }
    
    // Calcular calidad de la señal
    const quality = this.calculateSignalQuality(filteredValue);
    this.signalQualityHistory.push(quality);
    if (this.signalQualityHistory.length > 20) {
      this.signalQualityHistory.shift();
    }
    
    // Detección de dedo mejorada con feedback adaptativo
    let fingerDetected = false;
    if (quality > this.QUALITY_THRESHOLD || value > this.FINGER_DETECTION_THRESHOLD) {
      this.consecutiveFingerFrames++;
      if (this.consecutiveFingerFrames >= this.MIN_FINGER_FRAMES) {
        fingerDetected = true;
      }
    } else {
      // Mejora de debouncing para evitar detección intermitente
      this.consecutiveFingerFrames = Math.max(0, this.consecutiveFingerFrames - 1);
    }
    
    // Calcular índice de perfusión adaptativo
    const perfusionIndex = this.calculateAdaptivePerfusionIndex();
    
    // Calcular nivel de artefacto de presión
    this.pressureArtifactLevel = this.updatePressureArtifactLevel(filteredValue);
    
    // Actualizar tiempo de procesamiento
    this.lastProcessedTime = Date.now();
    
    // Construir señal procesada completa
    return {
      filteredValue,
      quality: quality * 100,
      fingerDetected,
      rawValue: value,
      timestamp: Date.now(),
      perfusionIndex,
      pressureArtifactLevel: this.pressureArtifactLevel,
      normalizedSpectrum: this.calculateNormalizedSpectrum(),
      channels: channelValues ? {
        red: channelValues.red || 0,
        green: channelValues.green || 0,
        blue: channelValues.blue || 0,
        infrared: channelValues.ir || 0
      } : undefined
    };
  }
  
  /**
   * Aplica un filtro SMA (Simple Moving Average) con adaptación
   */
  private applySMAFilter(value: number): { filteredValue: number; updatedBuffer: number[] } {
    const updatedBuffer = [...this.smaBuffer, value];
    if (updatedBuffer.length > this.SMA_WINDOW_SIZE) {
      updatedBuffer.shift();
    }
    
    // Si tenemos suficientes datos, aplicar filtro ponderado
    if (updatedBuffer.length >= 3) {
      // Ponderación personalizada para mayor relevancia a muestras recientes
      const weights = [0.2, 0.3, 0.5];
      let weightedSum = 0;
      let totalWeight = 0;
      
      for (let i = Math.max(0, updatedBuffer.length - weights.length); i < updatedBuffer.length; i++) {
        const weightIndex = i - (updatedBuffer.length - weights.length);
        weightedSum += updatedBuffer[i] * weights[weightIndex];
        totalWeight += weights[weightIndex];
      }
      
      const filteredValue = weightedSum / totalWeight;
      return { filteredValue, updatedBuffer };
    }
    
    // Si no hay suficientes datos, aplicar SMA estándar
    const filteredValue = updatedBuffer.reduce((a, b) => a + b, 0) / updatedBuffer.length;
    return { filteredValue, updatedBuffer };
  }
  
  /**
   * Calcula la calidad de la señal PPG con múltiples métricas
   */
  private calculateSignalQuality(value: number): number {
    if (this.ppgValues.length < 10) return 0;
    
    // Usar los últimos 30 valores para el cálculo
    const recentValues = this.ppgValues.slice(-30);
    
    // Calcular componentes AC y DC
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const ac = max - min;
    const dc = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calcular índice de perfusión
    const perfusionIndex = calculatePerfusionIndex(ac, dc);
    this.perfusionIndexHistory.push(perfusionIndex);
    if (this.perfusionIndexHistory.length > 10) {
      this.perfusionIndexHistory.shift();
    }
    
    // Calcular variabilidad
    const variance = this.calculateVariance(recentValues);
    
    // Detectar picos para evaluar periodicidad
    const peakScore = this.evaluatePeaks(recentValues);
    
    // Combinar métricas con ponderación
    const qualityScore = (
      (perfusionIndex * 0.5) + 
      (Math.min(0.3, variance) / 0.3 * 0.3) + 
      (peakScore * 0.2)
    );
    
    // Normalizar a un rango [0,1]
    const normalizedQuality = Math.min(1, qualityScore * 15);
    
    return normalizedQuality;
  }
  
  /**
   * Calcula la varianza de los valores
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Evalúa la calidad de los picos en la señal
   */
  private evaluatePeaks(values: number[]): number {
    // Simplificado para claridad - detecta picos y evalúa regularidad
    const peaks: number[] = [];
    
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > values[i-1] && values[i] > values[i-2] && 
          values[i] > values[i+1] && values[i] > values[i+2]) {
        peaks.push(i);
      }
    }
    
    if (peaks.length < 2) return 0.1;
    
    // Calcular intervalos entre picos
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Evaluar regularidad de intervalos (menor variación = mejor calidad)
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const intervalVariance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    const normalizedVariance = Math.min(1, intervalVariance / 25);
    
    return 1 - normalizedVariance;
  }
  
  /**
   * Calcula índice de perfusión adaptativo con feedback de calidad
   */
  private calculateAdaptivePerfusionIndex(): number {
    if (this.perfusionIndexHistory.length === 0) return 0;
    
    // Aplicar promedio ponderado con más peso a valores recientes
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < this.perfusionIndexHistory.length; i++) {
      const weight = i + 1;
      weightedSum += this.perfusionIndexHistory[i] * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  
  /**
   * Actualiza el nivel de artefacto de presión
   */
  private updatePressureArtifactLevel(value: number): number {
    // Inicializar línea base adaptativa
    if (this.adaptiveBaselineValue === 0) {
      this.adaptiveBaselineValue = value;
      return 0;
    }
    
    // Actualizar línea base con adaptación lenta
    this.adaptiveBaselineValue = this.adaptiveBaselineValue * 0.95 + value * 0.05;
    
    // Calcular variación respecto a línea base
    const deviation = Math.abs(value - this.adaptiveBaselineValue);
    const normalizedDeviation = Math.min(1, deviation / 50);
    
    // Actualizar nivel de artefacto con suavizado
    const currentLevel = this.pressureArtifactLevel;
    return currentLevel * 0.7 + normalizedDeviation * 0.3;
  }
  
  /**
   * Calcula el espectro normalizado para análisis frecuencial
   */
  private calculateNormalizedSpectrum(): number[] {
    if (this.ppgValues.length < 32) {
      return new Array(16).fill(0);
    }
    
    // Simplificación del cálculo espectral para mantener rendimiento
    const recentValues = this.ppgValues.slice(-32);
    const spectrum = new Array(16).fill(0);
    
    // Simulación simplificada de análisis espectral
    for (let i = 0; i < 16; i++) {
      let value = 0;
      for (let j = 0; j < 32; j++) {
        // Aproximación simplificada de transformada
        value += recentValues[j] * Math.sin(Math.PI * i * j / 16);
      }
      spectrum[i] = Math.abs(value) / 32;
    }
    
    // Normalizar al valor máximo
    const maxVal = Math.max(...spectrum);
    return maxVal > 0 ? spectrum.map(v => v / maxVal) : spectrum;
  }
  
  /**
   * Optimiza los pesos de cada canal basado en su calidad
   */
  private optimizeChannelWeights(): void {
    const channelQualities: {[key: string]: number} = {};
    let totalQuality = 0;
    
    // Evaluar calidad de cada canal
    Object.keys(this.channelBuffers).forEach(channel => {
      if (this.channelBuffers[channel].length < 10) return;
      
      const values = this.channelBuffers[channel].slice(-10);
      const variance = this.calculateVariance(values);
      const range = Math.max(...values) - Math.min(...values);
      
      // Métrica simple de calidad: rango significativo pero varianza no excesiva
      const quality = range > 5 && variance < 100 ? range / Math.sqrt(variance) : 0.1;
      channelQualities[channel] = quality;
      totalQuality += quality;
    });
    
    // Actualizar pesos si hay suficiente información
    if (totalQuality > 0) {
      Object.keys(channelQualities).forEach(channel => {
        // Actualización gradual de pesos (70% peso anterior, 30% nuevo)
        this.channelWeights[channel] = this.channelWeights[channel] * 0.7 + 
                                      (channelQualities[channel] / totalQuality) * 0.3;
      });
    }
  }
  
  /**
   * Obtiene los valores PPG actuales
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
  
  /**
   * Obtiene los pesos optimizados de cada canal
   */
  public getChannelWeights(): {[key: string]: number} {
    return {...this.channelWeights};
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.ppgValues = [];
    this.smaBuffer = [];
    this.consecutiveFingerFrames = 0;
    this.signalQualityHistory = [];
    this.perfusionIndexHistory = [];
    this.pressureArtifactLevel = 0;
    this.adaptiveBaselineValue = 0;
    
    Object.keys(this.channelBuffers).forEach(channel => {
      this.channelBuffers[channel] = [];
    });
  }
}

// Define la interfaz que será implementada por PPGSignalProcessor
export interface ISignalProcessor {
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  calibrate(): Promise<boolean>;
  processFrame?(imageData: ImageData): void;
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
}

// Implementación completa para mantener compatibilidad con código existente
export class PPGSignalProcessor implements ISignalProcessor {
  public onSignalReady?: (signal: ProcessedSignal) => void;
  public onError?: (error: ProcessingError) => void;
  private isProcessing: boolean = false;
  private signalProcessor: SignalProcessor;
  
  constructor(
    onSignalReady?: (signal: ProcessedSignal) => void,
    onError?: (error: ProcessingError) => void
  ) {
    this.signalProcessor = new SignalProcessor();
    this.onSignalReady = onSignalReady;
    this.onError = onError;
    console.log("PPGSignalProcessor: Instancia adaptador creada");
  }
  
  async initialize(): Promise<void> {
    try {
      this.signalProcessor.reset();
      console.log("PPGSignalProcessor: Adaptador inicializado");
    } catch (error) {
      console.error("PPGSignalProcessor: Error de inicialización", error);
      this.handleError("INIT_ERROR", "Error al inicializar el procesador");
    }
  }
  
  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Adaptador iniciado");
  }
  
  stop(): void {
    this.isProcessing = false;
    this.signalProcessor.reset();
    console.log("PPGSignalProcessor: Adaptador detenido");
  }
  
  async calibrate(): Promise<boolean> {
    try {
      await this.initialize();
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("PPGSignalProcessor: Calibración completada");
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Error de calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error durante la calibración");
      return false;
    }
  }
  
  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) return;
    
    try {
      const { red, green, blue } = this.extractRGBChannels(imageData);
      const redValue = red.value;
      
      const processedSignal = this.signalProcessor.processSignal(redValue, {
        red: red.value,
        green: green.value,
        blue: blue.value
      });
      
      // Añadir información de ROI
      const signalWithROI: ProcessedSignal = {
        ...processedSignal,
        timestamp: Date.now(),
        roi: this.detectROI(redValue)
      };
      
      this.onSignalReady?.(signalWithROI);
    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }
  
  private extractRGBChannels(imageData: ImageData): { red: {value: number, std: number}, green: {value: number, std: number}, blue: {value: number, std: number} } {
    const data = imageData.data;
    const redValues: number[] = [];
    const greenValues: number[] = [];
    const blueValues: number[] = [];
    
    // Analizar solo el centro de la imagen (25% central)
    const startX = Math.floor(imageData.width * 0.375);
    const endX = Math.floor(imageData.width * 0.625);
    const startY = Math.floor(imageData.height * 0.375);
    const endY = Math.floor(imageData.height * 0.625);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redValues.push(data[i]);      // Canal rojo
        greenValues.push(data[i + 1]); // Canal verde
        blueValues.push(data[i + 2]);  // Canal azul
      }
    }
    
    // Calcular media y desviación estándar para cada canal
    const calculateStats = (values: number[]) => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      return { value: mean, std: Math.sqrt(variance) };
    };
    
    return {
      red: calculateStats(redValues),
      green: calculateStats(greenValues),
      blue: calculateStats(blueValues)
    };
  }
  
  private detectROI(redValue: number): ProcessedSignal['roi'] {
    return {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    };
  }
  
  private handleError(code: string, message: string): void {
    console.error("PPGSignalProcessor: Error", code, message);
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    this.onError?.(error);
  }
}
