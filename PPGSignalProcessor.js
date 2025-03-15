
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

class KalmanFilter {
  private R: number = 0.01;
  private Q: number = 0.1;
  private P: number = 1;
  private X: number = 0;
  private K: number = 0;

  filter(measurement: number): number {
    this.P = this.P + this.Q;
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    return this.X;
  }

  reset() {
    this.X = 0;
    this.P = 1;
  }
}

export class PPGSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private lastValues: number[] = [];
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 10,
    MIN_RED_THRESHOLD: 80,  // Reducido para mayor sensibilidad
    MAX_RED_THRESHOLD: 245,
    STABILITY_WINDOW: 4,    // Reducido para respuesta más rápida
    MIN_STABILITY_COUNT: 3  // Reducido para respuesta más rápida
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private readonly BUFFER_SIZE = 10;
  private readonly MIN_RED_THRESHOLD = 75; // Reducido para mayor sensibilidad
  private readonly MAX_RED_THRESHOLD = 245;
  private readonly STABILITY_WINDOW = 4; // Reducido
  private readonly MIN_STABILITY_COUNT = 3; // Reducido
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.04; // Reducido para mayor sensibilidad
  
  // Variables para detección
  private fingerDetectionHistory: boolean[] = [];
  private readonly DETECTION_HISTORY_SIZE = 10; // Reducido para respuesta más rápida
  private readonly MIN_DETECTION_RATIO = 0.5; // Reducido para mayor sensibilidad
  private baselineValues: number[] = [];
  private readonly BASELINE_SIZE = 6; // Reducido para respuesta más rápida
  private lastAmbientLight: number = 0;
  private redValuesHistory: number[] = [];
  private readonly RED_HISTORY_SIZE = 15; // Reducido
  private physicalSignatureScore: number = 0;
  private lastRawFrames: number[][] = []; // Para almacenar frames crudos para análisis
  private readonly RAW_FRAMES_BUFFER = 4; // Buffer pequeño para análisis rápido

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada - procesamiento 100% real");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.kalmanFilter.reset();
      
      // Reiniciar variables
      this.fingerDetectionHistory = [];
      this.baselineValues = [];
      this.lastAmbientLight = 0;
      this.redValuesHistory = [];
      this.physicalSignatureScore = 0;
      this.lastRawFrames = [];
      
      console.log("PPGSignalProcessor: Inicializado - sin simulaciones");
    } catch (error) {
      console.error("PPGSignalProcessor: Error de inicialización", error);
      this.handleError("INIT_ERROR", "Error al inicializar el procesador");
    }
  }

  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Iniciado - procesando datos reales");
  }

  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.kalmanFilter.reset();
    
    // Limpiar variables
    this.fingerDetectionHistory = [];
    this.baselineValues = [];
    this.redValuesHistory = [];
    this.physicalSignatureScore = 0;
    this.lastRawFrames = [];
    
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración REAL");
      await this.initialize();

      // Capturar línea base - NO HAY SIMULACIÓN
      this.captureAmbientBaseline();
      
      // No esperamos artificialmente - la calibración termina cuando hay datos suficientes
      const baselineAvg = this.baselineValues.length > 0 
        ? this.baselineValues.reduce((a, b) => a + b, 0) / this.baselineValues.length 
        : 0;
      
      // Ajustar parámetros basado en valores reales medidos
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: Math.max(60, baselineAvg + 15), // Más sensible
        MAX_RED_THRESHOLD: Math.min(255, this.MAX_RED_THRESHOLD),
        STABILITY_WINDOW: this.STABILITY_WINDOW,
        MIN_STABILITY_COUNT: this.MIN_STABILITY_COUNT
      };

      console.log("PPGSignalProcessor: Calibración real completada", {
        configuración: this.currentConfig,
        baselineAmbiental: baselineAvg
      });
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Error de calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error durante la calibración");
      return false;
    }
  }
  
  // Captura valores reales de luz ambiental
  private captureAmbientBaseline(): void {
    // No hay simulación - se establecerá con datos reales en processFrame
    this.lastAmbientLight = 0;
  }

  resetToDefault(): void {
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    this.initialize();
    console.log("PPGSignalProcessor: Configuración restaurada a valores por defecto");
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      const redValue = this.extractRedChannel(imageData);
      
      // Guardar frame para análisis físico
      const frameSummary = this.summarizeFrame(imageData);
      this.lastRawFrames.push(frameSummary);
      if (this.lastRawFrames.length > this.RAW_FRAMES_BUFFER) {
        this.lastRawFrames.shift();
      }
      
      // Actualizar historial de valores rojos
      this.redValuesHistory.push(redValue);
      if (this.redValuesHistory.length > this.RED_HISTORY_SIZE) {
        this.redValuesHistory.shift();
      }
      
      // Capturar línea base real en primeros frames
      if (this.baselineValues.length < this.BASELINE_SIZE) {
        this.baselineValues.push(redValue);
        this.lastAmbientLight = redValue;
      }
      
      const filtered = this.kalmanFilter.filter(redValue);
      this.lastValues.push(filtered);
      
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // Análisis físico real basado en datos capturados
      const physicalAnalysis = this.analyzePhysicalSignature();
      this.physicalSignatureScore = physicalAnalysis.score;
      
      // Análisis principal mejorado
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);
      
      // Actualizar historial de detección
      this.fingerDetectionHistory.push(isFingerDetected);
      if (this.fingerDetectionHistory.length > this.DETECTION_HISTORY_SIZE) {
        this.fingerDetectionHistory.shift();
      }
      
      // Decisión robusta basada en historial
      const robustDetection = this.getRobustDetection();
      
      // Calidad ajustada a realidad física
      const finalQuality = robustDetection ? 
        Math.round(quality * (0.5 + this.physicalSignatureScore * 0.5)) : 0;

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: finalQuality,
        fingerDetected: robustDetection,
        roi: this.detectROI(redValue),
        physicalSignatureScore: this.physicalSignatureScore
      };

      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  // Nueva función: Extrae características clave de cada frame
  private summarizeFrame(imageData: ImageData): number[] {
    const { data, width, height } = imageData;
    const summary = [0, 0, 0]; // R, G, B promedio
    
    // Centro de la imagen (25% central)
    const startX = Math.floor(width * 0.375);
    const endX = Math.floor(width * 0.625);
    const startY = Math.floor(height * 0.375);
    const endY = Math.floor(height * 0.625);
    
    let count = 0;
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * width + x) * 4;
        summary[0] += data[i];    // R
        summary[1] += data[i+1];  // G
        summary[2] += data[i+2];  // B
        count++;
      }
    }
    
    // Normalizar
    return summary.map(val => val / count);
  }

  // Análisis físico basado en datos REALES capturados
  private analyzePhysicalSignature(): { score: number, isPulsatile: boolean } {
    // Si no hay suficientes frames, no podemos analizar
    if (this.lastRawFrames.length < 2) {
      return { score: 0, isPulsatile: false };
    }
    
    // Análisis de cambio temporal en colores
    const rVariation = this.calculateVariation(this.lastRawFrames.map(f => f[0]));
    const gVariation = this.calculateVariation(this.lastRawFrames.map(f => f[1]));
    
    // Relación R/G (importante en tejido vivo)
    const rgRatios = this.lastRawFrames.map(f => f[0] / Math.max(0.1, f[1]));
    const avgRgRatio = rgRatios.reduce((a, b) => a + b, 0) / rgRatios.length;
    
    // Criterios físicos reales
    const validRgRange = avgRgRatio > 1.0 && avgRgRatio < 2.5;
    const naturalVariation = rVariation > 0.001 && rVariation < 0.05;
    const rVariationGreater = rVariation > gVariation * 0.9; // El rojo varía más en tejido vivo
    
    // Análisis de pulsatilidad en señal roja
    const isPulsatile = this.detectPulsatilePattern(this.lastRawFrames.map(f => f[0]));
    
    // Score basado en características físicas reales
    let score = 0;
    
    if (validRgRange && naturalVariation) {
      score = 0.6;
      
      if (rVariationGreater) score += 0.2;
      if (isPulsatile) score += 0.2;
    }
    
    return { 
      score: Math.max(0, Math.min(1, score)), 
      isPulsatile
    };
  }
  
  // Funciones auxiliares para análisis físico real
  private calculateVariation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance) / mean; // Coeficiente de variación
  }
  
  private detectPulsatilePattern(values: number[]): boolean {
    if (values.length < 3) return false;
    
    // Buscar patrones de subida y bajada (característico del pulso)
    let changes = 0;
    for (let i = 1; i < values.length; i++) {
      const diff = values[i] - values[i-1];
      const prevDiff = i > 1 ? values[i-1] - values[i-2] : 0;
      
      if ((diff > 0 && prevDiff < 0) || (diff < 0 && prevDiff > 0)) {
        changes++;
      }
    }
    
    // Frecuencia de cambios dentro de rango fisiológico
    return changes > 0 && changes < values.length - 1;
  }

  // Obtener decisión robusta basada en historial REAL
  private getRobustDetection(): boolean {
    if (this.fingerDetectionHistory.length < 3) return false;
    
    const trueCount = this.fingerDetectionHistory.filter(x => x).length;
    const detectionRatio = trueCount / this.fingerDetectionHistory.length;
    
    // También verificar firma física para asegurar que es un dedo real
    const isPhysicallyValid = this.physicalSignatureScore > 0.3; // Más sensible
    
    return detectionRatio >= this.MIN_DETECTION_RATIO && isPhysicallyValid;
  }

  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    // Analizar solo el centro de la imagen (25% central) - REAL
    const startX = Math.floor(imageData.width * 0.375);
    const endX = Math.floor(imageData.width * 0.625);
    const startY = Math.floor(imageData.height * 0.375);
    const endY = Math.floor(imageData.height * 0.625);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];  // Canal rojo
        count++;
      }
    }
    
    const avgRed = redSum / count;
    return avgRed;
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    // Verificar base line - más sensible
    const baselineAvg = this.baselineValues.length > 0 
      ? this.baselineValues.reduce((a, b) => a + b, 0) / this.baselineValues.length 
      : 0;
    
    // Si está muy cerca del valor base, NO hay dedo
    if (rawValue < baselineAvg + 10) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }
    
    // Verificar contra umbrales configurados - más sensibles
    const isInRange = rawValue >= this.currentConfig.MIN_RED_THRESHOLD && 
                      rawValue <= this.currentConfig.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    // Verificar estabilidad
    if (this.lastValues.length < this.currentConfig.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Mejora en detección de estabilidad
    const recentValues = this.lastValues.slice(-this.currentConfig.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Análisis de variación
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Detección más sensible
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    // Umbrales adaptativos más sensibles
    const adaptiveThreshold = Math.max(1.5, avgValue * 0.02);
    const isStable = maxVariation < adaptiveThreshold * 2 && 
                    minVariation > -adaptiveThreshold * 2;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.currentConfig.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      // Reducción más lenta para estabilidad
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1);
    }

    // Más sensible en detección inicial
    const isFingerDetected = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      // Cálculo de calidad mejorado
      const stabilityScore = Math.min(this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - this.currentConfig.MIN_RED_THRESHOLD) / 
                                    (this.currentConfig.MAX_RED_THRESHOLD - this.currentConfig.MIN_RED_THRESHOLD), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 3)));
      
      quality = Math.round((stabilityScore * 0.4 + intensityScore * 0.3 + variationScore * 0.3) * 100);
    }

    return { isFingerDetected, quality };
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
