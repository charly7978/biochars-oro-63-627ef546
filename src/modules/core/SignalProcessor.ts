/**
 * NOTA IMPORTANTE: Este es un módulo de procesamiento de señales.
 * Las interfaces principales están en index.tsx y PPGSignalMeter.tsx que son INTOCABLES.
 */

import { applySMAFilter, calculatePerfusionIndex } from '../../utils/vitalSignsUtils';
import type { ProcessingError } from '../../types/signal';

export interface ProcessedSignal {
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  rawValue?: number;
  timestamp?: number;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class SignalProcessor {
  private readonly BUFFER_SIZE = 300;
  private readonly SMA_WINDOW_SIZE = 5;
  private readonly QUALITY_THRESHOLD = 0.03; // Lowered from 0.05 to increase sensitivity
  private readonly FINGER_DETECTION_THRESHOLD = 25; // Lowered from 30 to detect more easily
  
  private ppgValues: number[] = [];
  private smaBuffer: number[] = [];
  private lastProcessedTime: number = 0;
  private consecutiveFingerFrames: number = 0;
  private readonly MIN_FINGER_FRAMES = 2; // Reduced from 3 for faster detection
  
  /**
   * Procesa una señal PPG (fotopletismografía) y devuelve valores filtrados y análisis
   */
  public processSignal(value: number): ProcessedSignal {
    // Aplicar filtro SMA para suavizar la señal
    const { filteredValue, updatedBuffer } = applySMAFilter(value, this.smaBuffer, this.SMA_WINDOW_SIZE);
    this.smaBuffer = updatedBuffer;
    
    // Actualizar buffer de valores PPG
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > this.BUFFER_SIZE) {
      this.ppgValues.shift();
    }
    
    // Calcular calidad de la señal
    const quality = this.calculateSignalQuality(filteredValue);
    
    // Detección de dedo en el sensor mejorada
    let fingerDetected = false;
    if (quality > this.QUALITY_THRESHOLD || value > this.FINGER_DETECTION_THRESHOLD) {
      this.consecutiveFingerFrames++;
      if (this.consecutiveFingerFrames >= this.MIN_FINGER_FRAMES) {
        fingerDetected = true;
      }
    } else {
      // Improved debouncing to avoid quick toggling of detection state
      this.consecutiveFingerFrames = Math.max(0, this.consecutiveFingerFrames - 1);
    }
    
    // Actualizar tiempo de procesamiento
    this.lastProcessedTime = Date.now();
    
    return {
      filteredValue,
      quality: quality * 100, // Normalizar a porcentaje
      fingerDetected,
      rawValue: value,
      timestamp: Date.now()
    };
  }
  
  /**
   * Calcula la calidad de la señal PPG
   */
  private calculateSignalQuality(value: number): number {
    if (this.ppgValues.length < 10) return 0;
    
    // Usar los últimos 30 valores para el cálculo
    const recentValues = this.ppgValues.slice(-30);
    
    // Calcular AC y DC
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const ac = max - min;
    const dc = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calcular índice de perfusión
    const perfusionIndex = calculatePerfusionIndex(ac, dc);
    
    // Normalizar a un rango [0,1] donde valores mayores indican mejor calidad
    // Use a less stringent normalization to improve detection:
    const normalizedQuality = Math.min(1, perfusionIndex * 15);
    
    return normalizedQuality;
  }
  
  /**
   * Obtiene los valores PPG actuales
   */
  public getPPGValues(): number[] {
    return [...this.ppgValues];
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
    this.ppgValues = [];
    this.smaBuffer = [];
    this.consecutiveFingerFrames = 0;
  }
}

// Define the SignalProcessor interface that will be implemented by PPGSignalProcessor
export interface ISignalProcessor {
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  calibrate(): Promise<boolean>;
  processFrame?(imageData: ImageData): void;
  onSignalReady?: (signal: ProcessedSignal) => void;
  onError?: (error: ProcessingError) => void;
}

// Add this export to make the module compatible with existing imports
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
      const redValue = this.extractRedChannel(imageData);
      const processedSignal = this.signalProcessor.processSignal(redValue);
      
      // Add ROI information
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
  
  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    // Analizar solo el centro de la imagen (25% central)
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
    
    return redSum / count;
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
