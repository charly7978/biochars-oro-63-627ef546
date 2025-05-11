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
  
  // Parámetros para detección de piel (HSV) - Ajustar según sea necesario
  private readonly SKIN_LOWER = [0, 40, 30];   // Lower bound for HSV skin color
  private readonly SKIN_UPPER = [40, 255, 255]; // Upper bound for HSV skin color
  private readonly MIN_CONTOUR_AREA = 500; // Área mínima para considerar un contorno como dedo

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
      // console.warn("SignalProcessor: OpenCV not ready, skipping frame.");
      // Podríamos encolar frames o simplemente esperar
      if (!this.cvInitializing) {
        this.initializeOpenCV(); // Intentar inicializar si no lo está haciendo ya
      }
      // Devolver valores por defecto o nulos mientras no esté listo
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

    let srcMat: any = null;
    let rgbMat: any = null;
    let hsvMat: any = null;
    let skinMask: any = null;
    let contours: any = null;
    let hierarchy: any = null;
    let ppgValueFromRoi = 0;
    let roiRectForSignal: ProcessedSignal['roi'] = { x: 0, y: 0, width: imageData.width, height: imageData.height };
    let preBandpassVal = 0;

    try {
      srcMat = cv.matFromImageData(imageData);
      rgbMat = new cv.Mat();
      cv.cvtColor(srcMat, rgbMat, cv.COLOR_RGBA2RGB);
      hsvMat = new cv.Mat();
      cv.cvtColor(rgbMat, hsvMat, cv.COLOR_RGB2HSV);

      skinMask = new cv.Mat();
      const lowerSkin = new cv.Mat(hsvMat.rows, hsvMat.cols, hsvMat.type(), this.SKIN_LOWER);
      const upperSkin = new cv.Mat(hsvMat.rows, hsvMat.cols, hsvMat.type(), this.SKIN_UPPER);
      cv.inRange(hsvMat, lowerSkin, skinMask, skinMask);
      lowerSkin.delete();
      upperSkin.delete();
      
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(skinMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let largestContourArea = 0;
      let bestRect: cv.Rect | null = null;

      for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        if (area > this.MIN_CONTOUR_AREA && area > largestContourArea) {
          largestContourArea = area;
          bestRect = cv.boundingRect(contour);
        }
        contour.delete(); 
      }

      if (bestRect) {
        roiRectForSignal = { x: bestRect.x, y: bestRect.y, width: bestRect.width, height: bestRect.height };
        const roiMat = rgbMat.roi(bestRect);
        const meanColor = cv.mean(roiMat, new cv.Mat());
        ppgValueFromRoi = meanColor[0];
        roiMat.delete();
      } else {
        const centerX = Math.floor(imageData.width * 0.4);
        const centerY = Math.floor(imageData.height * 0.4);
        const fallbackWidth = Math.floor(imageData.width * 0.2);
        const fallbackHeight = Math.floor(imageData.height * 0.2);
        const fallbackRectCv = new cv.Rect(centerX, centerY, fallbackWidth, fallbackHeight);
        roiRectForSignal = {x: centerX, y: centerY, width: fallbackWidth, height: fallbackHeight };
        const fallbackRoiMat = rgbMat.roi(fallbackRectCv);
        const meanColorFallback = cv.mean(fallbackRoiMat);
        ppgValueFromRoi = meanColorFallback[0];
        fallbackRoiMat.delete();
      }
      preBandpassVal = ppgValueFromRoi;

      const detectionResult = fingerDetectionManager.processFrameAndSignal(imageData, ppgValueFromRoi, this.cvReady);

      const kalmanFiltered = this.kalmanFilter.filter(ppgValueFromRoi);
      const bandpassFiltered = this.bandpassFilter.filter(kalmanFiltered);

      const signal: ExtendedProcessedSignal = {
        timestamp: Date.now(),
        rawValue: ppgValueFromRoi,
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
      console.error("SignalProcessor: Error processing frame with OpenCV:", error);
      this.onError?.({ code: 'OPENCV_PROCESS_FRAME_ERROR', message: `Error en processFrame con OpenCV: ${error instanceof Error ? error.message : String(error)}`, timestamp: Date.now() });
    } finally {
      // **MUY IMPORTANTE: Liberar todas las Mats creadas**
      srcMat?.delete();
      rgbMat?.delete();
      hsvMat?.delete();
      skinMask?.delete();
      contours?.delete();
      hierarchy?.delete();
    }
  }
}
