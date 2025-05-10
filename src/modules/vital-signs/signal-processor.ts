/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalFilter } from './processors/signal-filter';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { KalmanFilter } from '@/core/signal/filters/KalmanFilter';
import { BandpassFilter } from '@/core/signal/filters/BandpassFilter';
import cv from '@techstark/opencv-js'; // Import OpenCV
import { fingerDetectionManager } from '@/services/FingerDetectionService'; // IMPORTADO

// Tipos para claridad, ajusta según tu definición exacta
import { ProcessedSignal, ProcessingError } from '@/types/signal';

// Ajustar la interfaz ProcessedSignal (idealmente en su propio archivo @/types/signal.d.ts)
// pero lo añadimos aquí para referencia rápida del cambio necesario.
interface ExtendedProcessedSignal extends ProcessedSignal {
  preBandpassValue: number;
}

/**
 * Signal processor for real PPG signals
 * Implements filtering and analysis techniques on real data only
 * Enhanced with rhythmic pattern detection for finger presence
 * No simulation or reference values are used
 */
export class SignalProcessor extends BaseProcessor {
  private filter: SignalFilter;
  private heartRateDetector: HeartRateDetector;
  private kalmanFilter: KalmanFilter;
  private bandpassFilter: BandpassFilter;
  
  // Estado de OpenCV
  private cvReady: boolean = false;
  private cvInitializing: boolean = false;
  
  constructor(
    public onSignalReady?: (signal: ExtendedProcessedSignal) => void,
    public onError?: (error: ProcessingError | { code: string; message: string; timestamp: number; }) => void
  ) {
    super();
    this.filter = new SignalFilter();
    this.heartRateDetector = new HeartRateDetector();
    this.kalmanFilter = new KalmanFilter();
    this.bandpassFilter = new BandpassFilter(0.5, 4, 30);
    this.initializeOpenCV(); // Iniciar carga de OpenCV
  }
  
  /**
   * Inicializa OpenCV.js de forma asíncrona.
   */
  private async initializeOpenCV(): Promise<void> {
    if (this.cvReady || this.cvInitializing) return;

    console.log("SignalProcessor: Initializing OpenCV...");
    this.cvInitializing = true;
    try {
      // Espera a que el módulo WASM/JS esté listo
      await new Promise<void>((resolve, reject) => {
        // @ts-ignore // Ignorar chequeo de tipo para cv.onRuntimeInitialized
        if (cv.runtimeInitialized) {
           resolve();
        } else {
           // @ts-ignore
           cv.onRuntimeInitialized = resolve;
           // Añadir un timeout por si acaso
           setTimeout(() => reject(new Error("OpenCV initialization timed out")), 15000);
        }
      });
      this.cvReady = true;
      console.log("SignalProcessor: OpenCV initialized successfully.");
    } catch (error) {
      console.error("SignalProcessor: Failed to initialize OpenCV:", error);
      this.onError?.({ code: 'OPENCV_INIT_FAILED', message: `Error initializing OpenCV: ${error instanceof Error ? error.message : String(error)}`, timestamp: Date.now() });
    } finally {
      this.cvInitializing = false;
    }
  }
  
  /**
   * Apply Moving Average filter to real values
   */
  public applySMAFilter(value: number): number {
    return this.filter.applySMAFilter(value, this.ppgValues);
  }
  
  /**
   * Apply Exponential Moving Average filter to real data
   */
  public applyEMAFilter(value: number, alpha?: number): number {
    return this.filter.applyEMAFilter(value, this.ppgValues, alpha);
  }
  
  /**
   * Apply median filter to real data
   */
  public applyMedianFilter(value: number): number {
    return this.filter.applyMedianFilter(value, this.ppgValues);
  }
  
  /**
   * Apply combined filtering for real signal processing
   * No simulation is used
   * Incorporates rhythmic pattern-based finger detection
   */
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean, confidence?: number, feedback?: string, roi?: any } {
    this.ppgValues.push(value);
    if (this.ppgValues.length > 100) {
      this.ppgValues.shift();
    }

    const detectionResult = fingerDetectionManager.processFrameAndSignal(undefined, value, this.cvReady);

    const kalmanFiltered = this.kalmanFilter.filter(value);
    const bandpassFiltered = this.bandpassFilter.filter(kalmanFiltered);

    return {
      filteredValue: bandpassFiltered,
      quality: detectionResult.quality,
      fingerDetected: detectionResult.isFingerDetected,
      confidence: detectionResult.confidence,
      feedback: detectionResult.feedback,
      roi: detectionResult.roi
    };
  }
  
  /**
   * Calculate heart rate from real PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    const filteredBuffer = this.ppgValues.map(v => this.bandpassFilter.filter(this.kalmanFilter.filter(v)));
    return this.heartRateDetector.calculateHeartRate(filteredBuffer, sampleRate);
  }
  
  /**
   * Reset the signal processor
   * Ensures all measurements start from zero
   */
  public reset(): void {
    super.reset();
    this.filter = new SignalFilter();
    this.heartRateDetector.reset();
    this.kalmanFilter.reset();
    this.bandpassFilter.reset();
    console.log("SignalProcessor: Reset.");
  }

  /**
   * Procesa un frame de vídeo usando OpenCV para detectar ROI y extraer señal.
   * @param imageData Datos del frame de la cámara.
   */
  public processFrame(imageData: ImageData): void {
    if (!this.cvReady) {
      if (!this.cvInitializing) {
        this.initializeOpenCV();
      }
      this.onError?.({ code: 'OPENCV_NOT_READY', message: 'OpenCV not ready for vital-signs processor.', timestamp: Date.now() });
      const fallbackDetection = fingerDetectionManager.processFrameAndSignal(undefined, undefined, false);
      this.onSignalReady?.({
        timestamp: Date.now(),
        rawValue: 0,
        filteredValue: 0,
        preBandpassValue: 0,
        quality: fallbackDetection.quality,
        fingerDetected: fallbackDetection.isFingerDetected,
        confidence: fallbackDetection.confidence,
        feedback: fallbackDetection.feedback,
        roi: fallbackDetection.roi || { x:0, y:0, width:0, height:0 },
      });
      return;
    }

    let ppgValueFromFDM = 0;
    let preBandpassVal = 0;

    try {
      const detectionResult = fingerDetectionManager.processFrameAndSignal(imageData, undefined, this.cvReady);

      ppgValueFromFDM = detectionResult.rawValue || 0; 
      preBandpassVal = ppgValueFromFDM; 

      const kalmanFiltered = this.kalmanFilter.filter(ppgValueFromFDM);
      const bandpassFiltered = this.bandpassFilter.filter(kalmanFiltered);

      const signal: ExtendedProcessedSignal = {
        timestamp: Date.now(),
        rawValue: ppgValueFromFDM,
        preBandpassValue: preBandpassVal,
        filteredValue: bandpassFiltered,
        quality: detectionResult.quality,
        fingerDetected: detectionResult.isFingerDetected,
        roi: detectionResult.roi,
        confidence: detectionResult.confidence,
        feedback: detectionResult.feedback,
      };
      this.onSignalReady?.(signal);

    } catch (error) {
      console.error("SignalProcessor (VitalSigns): Error en processFrame (post FDM call):", error);
      this.onError?.({ code: 'FDM_CALL_ERROR', message: `Error procesando con FingerDetectionManager: ${error instanceof Error ? error.message : String(error)}`, timestamp: Date.now() });
    } 
  }
}
