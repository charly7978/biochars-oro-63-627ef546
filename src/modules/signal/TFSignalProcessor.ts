import { SignalProcessor, ProcessedSignal, ProcessingError } from '../../types/signal';
import * as tf from '@tensorflow/tfjs';
import { KalmanFilter } from '../signal/filters/KalmanFilter';
import { WaveletDenoiser } from '../signal/filters/WaveletDenoiser';
import { FFTProcessor } from '../signal/processors/FFTProcessor';
import { SignalQualityAnalyzer } from '../signal/quality/SignalQualityAnalyzer';
import TensorFlowService from '../../services/TensorFlowService';

/**
 * Procesador de señales PPG basado en TensorFlow
 * Implementa algoritmos avanzados de procesamiento de señales
 */
export class TFSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private waveletDenoiser: WaveletDenoiser;
  private fftProcessor: FFTProcessor;
  private qualityAnalyzer: SignalQualityAnalyzer;
  private signalBuffer: number[] = [];
  private readonly BUFFER_SIZE = 128;
  private readonly QUALITY_THRESHOLD = 60;
  private readonly MIN_FINGER_DETECTION_QUALITY = 40;
  private baselineValue: number = 0;
  private lastProcessedValue: number = 0;
  private lastQualityScore: number = 0;
  private fingerDetectionCounter: number = 0;
  private readonly MIN_FINGER_DETECTION_COUNT = 5;
  private modelLoaded: boolean = false;
  private processingModel: tf.LayersModel | null = null;
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.waveletDenoiser = new WaveletDenoiser();
    this.fftProcessor = new FFTProcessor();
    this.qualityAnalyzer = new SignalQualityAnalyzer();
    
    console.log("TFSignalProcessor: Instancia creada");
  }
  
  /**
   * Inicializa el procesador y carga modelos necesarios
   */
  public async initialize(): Promise<void> {
    try {
      console.log("TFSignalProcessor: Inicializando...");
      
      // Inicializar componentes
      this.kalmanFilter.reset();
      this.waveletDenoiser.initialize();
      this.fftProcessor.initialize();
      this.qualityAnalyzer.initialize();
      
      // Cargar modelo TensorFlow si es necesario
      await this.loadModel();
      
      console.log("TFSignalProcessor: Inicialización completa");
    } catch (error) {
      console.error("TFSignalProcessor: Error en inicialización", error);
      this.handleError("INIT_ERROR", "Error inicializando procesador");
      throw error;
    }
  }
  
  /**
   * Carga el modelo de procesamiento
   */
  private async loadModel(): Promise<void> {
    try {
      // Usar servicio centralizado para cargar modelo
      await TensorFlowService.loadModel('signal-processor');
      this.modelLoaded = true;
    } catch (error) {
      console.warn("TFSignalProcessor: No se pudo cargar modelo, usando procesamiento alternativo", error);
      // Continuar sin modelo, usando procesamiento alternativo
    }
  }
  
  /**
   * Inicia el procesamiento de señales
   */
  public start(): void {
    this.isProcessing = true;
    this.signalBuffer = [];
    this.fingerDetectionCounter = 0;
    console.log("TFSignalProcessor: Procesamiento iniciado");
  }
  
  /**
   * Detiene el procesamiento de señales
   */
  public stop(): void {
    this.isProcessing = false;
    console.log("TFSignalProcessor: Procesamiento detenido");
  }
  
  /**
   * Calibra el procesador para condiciones actuales
   */
  public async calibrate(): Promise<boolean> {
    try {
      console.log("TFSignalProcessor: Iniciando calibración");
      
      // Reiniciar componentes
      this.kalmanFilter.reset();
      this.waveletDenoiser.reset();
      this.signalBuffer = [];
      this.baselineValue = 0;
      
      // Calibrar analizador de calidad
      await this.qualityAnalyzer.calibrate();
      
      console.log("TFSignalProcessor: Calibración completada");
      return true;
    } catch (error) {
      console.error("TFSignalProcessor: Error en calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error en calibración");
      return false;
    }
  }
  
  /**
   * Procesa un frame de señal PPG
   */
  public processFrame(value: number): void {
    if (!this.isProcessing) return;
    
    try {
      // Aplicar filtros básicos
      const kalmanFiltered = this.kalmanFilter.filter(value);
      const filteredValue = this.waveletDenoiser.denoise(kalmanFiltered);
      
      // Actualizar buffer de señal
      this.signalBuffer.push(filteredValue);
      if (this.signalBuffer.length > this.BUFFER_SIZE) {
        this.signalBuffer.shift();
      }
      
      // Actualizar línea base
      if (this.baselineValue === 0) {
        this.baselineValue = filteredValue;
      } else {
        this.baselineValue = this.baselineValue * 0.95 + filteredValue * 0.05;
      }
      
      // Analizar calidad de señal
      const qualityResult = this.qualityAnalyzer.analyzeQuality(this.signalBuffer);
      const qualityScore = qualityResult.overall;
      this.lastQualityScore = qualityScore;
      
      // Detección de dedo
      let isFingerDetected = false;
      if (qualityScore > this.MIN_FINGER_DETECTION_QUALITY) {
        this.fingerDetectionCounter = Math.min(this.fingerDetectionCounter + 1, this.MIN_FINGER_DETECTION_COUNT * 2);
      } else {
        this.fingerDetectionCounter = Math.max(0, this.fingerDetectionCounter - 1);
      }
      
      isFingerDetected = this.fingerDetectionCounter >= this.MIN_FINGER_DETECTION_COUNT;
      
      // Calcular índice de perfusión
      const perfusionIndex = this.calculatePerfusionIndex();
      
      // Procesar espectro de frecuencia si hay suficientes datos
      let spectrumData = undefined;
      if (this.signalBuffer.length >= 64 && isFingerDetected) {
        spectrumData = this.fftProcessor.processFFT(this.signalBuffer.slice(-64));
      }
      
      // Crear objeto de señal procesada
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: value,
        filteredValue: filteredValue,
        fingerDetected: isFingerDetected,
        quality: qualityScore,
        perfusionIndex: perfusionIndex,
        spectrumData: spectrumData
      };
      
      // Notificar señal procesada
      this.onSignalReady?.(processedSignal);
      
      // Procesar calidad para análisis
      this.processQualityScore({
        quality: qualityScore,
        noise: qualityResult.noise,
        stability: qualityResult.stability,
        periodicity: qualityResult.periodicity,
        timestamp: Date.now()
      });
      
      this.lastProcessedValue = filteredValue;
    } catch (error) {
      console.error("TFSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error procesando señal");
    }
  }
  
  /**
   * Calcula el índice de perfusión
   */
  private calculatePerfusionIndex(): number {
    if (this.signalBuffer.length < 30) return 0;
    
    const recentValues = this.signalBuffer.slice(-30);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const dc = (max + min) / 2;
    
    if (dc === 0) return 0;
    
    const ac = max - min;
    const pi = (ac / dc) * 100;
    
    return Math.min(pi, 10); // Limitar a un máximo razonable
  }
  
  /**
   * Procesa puntuación de calidad para análisis
   */
  private processQualityScore(qualityData: {
    quality: number;
    noise: number;
    stability: number;
    periodicity: number;
    timestamp: number;
  }): void {
    // Implementar lógica adicional si es necesario
    // Por ejemplo, notificar cambios significativos en calidad
    
    if (qualityData.quality < this.QUALITY_THRESHOLD && this.lastQualityScore >= this.QUALITY_THRESHOLD) {
      console.warn("TFSignalProcessor: Calidad de señal degradada", qualityData);
    }
  }
  
  /**
   * Maneja errores del procesador
   */
  private handleError(code: string, message: string): void {
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    
    console.error(`TFSignalProcessor Error: [${code}] ${message}`);
    this.onError?.(error);
  }
  
  /**
   * Libera recursos
   */
  public dispose(): void {
    this.stop();
    this.waveletDenoiser.dispose();
    this.fftProcessor.dispose();
    
    // Limpiar buffer y referencias
    this.signalBuffer = [];
    this.processingModel = null;
    
    console.log("TFSignalProcessor: Recursos liberados");
  }
}
