/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalFilter } from './processors/signal-filter';
import { SignalQuality } from './processors/signal-quality';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { SignalValidator } from './validators/signal-validator';
import { KalmanFilter } from '@/core/signal/filters/KalmanFilter';
import { BandpassFilter } from '@/core/signal/filters/BandpassFilter';
import cv from '@techstark/opencv-js'; // Import OpenCV

// Tipos para claridad, ajusta según tu definición exacta
import { ProcessedSignal, ProcessingError } from '@/types/signal';

/**
 * Signal processor for real PPG signals
 * Implements filtering and analysis techniques on real data only
 * Enhanced with rhythmic pattern detection for finger presence
 * No simulation or reference values are used
 */
export class SignalProcessor extends BaseProcessor {
  private filter: SignalFilter;
  private quality: SignalQuality;
  private heartRateDetector: HeartRateDetector;
  private signalValidator: SignalValidator;
  private kalmanFilter: KalmanFilter;
  private bandpassFilter: BandpassFilter;
  
  // Finger detection state
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  // Signal quality variables - more strict thresholds
  private readonly MIN_QUALITY_FOR_FINGER = 35; // Reducido ligeramente, ROI puede ayudar
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 3000; // Reducido ligeramente
  private readonly MIN_SIGNAL_AMPLITUDE = 0.01; // Ajustado para ser más sensible después del pasa-banda
  
  // Parámetros para detección de piel (HSV) - Ajustar según sea necesario
  private readonly SKIN_LOWER = [0, 40, 30];   // Lower bound for HSV skin color
  private readonly SKIN_UPPER = [40, 255, 255]; // Upper bound for HSV skin color
  private readonly MIN_CONTOUR_AREA = 500; // Área mínima para considerar un contorno como dedo

  // Estado de OpenCV
  private cvReady: boolean = false;
  private cvInitializing: boolean = false;
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError | { code: string; message: string; timestamp: number; }) => void
  ) {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(this.MIN_SIGNAL_AMPLITUDE);
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
   * Check if finger is detected based on rhythmic patterns
   * Uses physiological characteristics (heartbeat rhythm)
   */
  public isFingerDetected(): boolean {
    if (this.fingerDetectionConfirmed) {
      return true;
    }
    
    const currentQuality = this.quality.calculateSignalQuality(this.ppgValues);
    const patternDetected = this.signalValidator.isFingerDetected();

    if (patternDetected && currentQuality > this.MIN_QUALITY_FOR_FINGER) {
      if (!this.fingerDetectionStartTime) {
        this.fingerDetectionStartTime = Date.now();
      } else if (Date.now() - this.fingerDetectionStartTime > this.MIN_PATTERN_CONFIRMATION_TIME) {
        this.fingerDetectionConfirmed = true;
        return true;
      }
    } else {
      this.fingerDetectionStartTime = null;
    }
    return false;
  }
  
  /**
   * Apply combined filtering for real signal processing
   * No simulation is used
   * Incorporates rhythmic pattern-based finger detection
   */
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean } {
    this.ppgValues.push(value);
    if (this.ppgValues.length > 100) {
      this.ppgValues.shift();
    }
    this.signalValidator.trackSignalForPatternDetection(value);

    const kalmanFiltered = this.kalmanFilter.filter(value);
    const bandpassFiltered = this.bandpassFilter.filter(kalmanFiltered);

    const finalFiltered = bandpassFiltered;

    this.quality.updateNoiseLevel(value, finalFiltered);
    const currentQuality = this.quality.calculateSignalQuality(this.ppgValues.map(v => this.bandpassFilter.filter(this.kalmanFilter.filter(v))));

    const fingerDetected = this.isFingerDetected();

    return {
      filteredValue: finalFiltered,
      quality: currentQuality,
      fingerDetected: fingerDetected
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
    this.quality.reset();
    this.heartRateDetector.reset();
    this.signalValidator.resetFingerDetection();
    this.kalmanFilter.reset();
    this.bandpassFilter.reset();
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
    // No reiniciamos OpenCV aquí, debe seguir cargado.
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
      this.onError?.({ code: 'OPENCV_NOT_READY', message: 'OpenCV not ready.', timestamp: Date.now() });
      // Opcional: llamar a onSignalReady con datos nulos/inválidos
      // this.onSignalReady?.({ /* datos nulos o inválidos */ });
      return;
    }

    let src: any = null; // Usar 'any' temporalmente por tipos OpenCV
    let hsv: any = null;
    let mask: any = null;
    let contours: any = null;
    let hierarchy: any = null;
    let roiMask: any = null;
    let maskedSrc: any = null;
    let rawValue = 0;
    let roiFound = false;
    let roiRect = { x: 0, y: 0, width: imageData.width, height: imageData.height }; // Default a full frame

    try {
      // Convertir ImageData a cv.Mat (RGBA)
      src = cv.matFromImageData(imageData);

      // Convertir a HSV
      hsv = new cv.Mat();
      cv.cvtColor(src, hsv, cv.COLOR_RGBA2HSV);

      // Crear máscara para tono de piel
      mask = new cv.Mat();
      const lower = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), this.SKIN_LOWER.concat(0)); // Añadir alpha si es necesario
      const upper = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), this.SKIN_UPPER.concat(255));
      cv.inRange(hsv, lower, upper, mask);
      lower.delete();
      upper.delete();

      // Opcional: Mejorar la máscara (Morphological Operations)
      // let kernel = cv.Mat.ones(5, 5, cv.CV_8U);
      // cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
      // cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
      // kernel.delete();

      // Encontrar contornos
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      // Encontrar el contorno más grande (presumiblemente el dedo)
      let largestContourIndex = -1;
      let maxArea = 0;
      for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        if (area > this.MIN_CONTOUR_AREA && area > maxArea) {
          maxArea = area;
          largestContourIndex = i;
        }
        contour.delete(); // Liberar contorno individual
      }

      if (largestContourIndex !== -1) {
        roiFound = true;
        const fingerContour = contours.get(largestContourIndex);
        roiRect = cv.boundingRect(fingerContour);

        // Crear una máscara solo para el ROI del dedo
        roiMask = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
        const roiContours = new cv.MatVector();
        roiContours.push_back(fingerContour);
        cv.drawContours(roiMask, roiContours, 0, new cv.Scalar(255), cv.FILLED);
        roiContours.delete(); // Liberar MatVector

        // Aplicar máscara al frame original para aislar el dedo
        maskedSrc = new cv.Mat();
        src.copyTo(maskedSrc, roiMask); // Copia solo los píxeles donde roiMask es > 0

        // Calcular la media del canal rojo DENTRO del ROI
        // cv.mean devuelve [B, G, R, A]
        const meanColor = cv.mean(src, roiMask);
        rawValue = meanColor[2]; // Índice 2 para el canal Rojo

        fingerContour.delete(); // Liberar el contorno usado
      } else {
        // No se encontró dedo/ROI válido, usar media global o valor por defecto?
        // Usar media global puede ser ruidoso. Usar 0 indica falta de señal fiable.
        rawValue = 0; // Opcional: meanColor = cv.mean(src); rawValue = meanColor[2];
        // console.log("SignalProcessor: No suitable ROI found.");
      }

      // ---- Procesamiento de señal subsiguiente ----
      // Añadir valor (extraído de ROI o 0) al buffer principal
      this.ppgValues.push(rawValue);
      if (this.ppgValues.length > 100) {
        this.ppgValues.shift();
      }
      this.signalValidator.trackSignalForPatternDetection(rawValue); // Usar rawValue para patrón

      // 1. Filtro Kalman (puede ayudar incluso con señal de ROI)
      const kalmanFiltered = this.kalmanFilter.filter(rawValue);

      // 2. Filtro Pasa-Banda
      const bandpassFiltered = this.bandpassFilter.filter(kalmanFiltered);

      // 3. Calcular calidad (ahora basado en la señal del ROI procesada)
      // Se podría mejorar la calidad usando el área del ROI, estabilidad, etc.
      this.quality.updateNoiseLevel(rawValue, bandpassFiltered); // Comparar raw (ROI) con filtrado
      const currentQuality = roiFound ? this.quality.calculateSignalQuality(this.ppgValues) : 0; // Calidad 0 si no hay ROI

      // 4. Detectar dedo (basado en patrón y calidad)
      const fingerDetected = this.isFingerDetected() && roiFound; // Requiere ROI y patrón/calidad

      // 5. Preparar señal procesada para emitir
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: rawValue,
        filteredValue: bandpassFiltered,
        quality: currentQuality,
        fingerDetected: fingerDetected,
        roi: roiRect, // Incluir la info del ROI
        // Opcional: añadir otros datos como perfusionIndex si se calculan
      };

      // Emitir señal procesada
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }

    } catch (error) {
      console.error("SignalProcessor: Error processing frame with OpenCV:", error);
      this.onError?.({ code: 'OPENCV_PROCESS_ERROR', message: `Error during OpenCV processing: ${error instanceof Error ? error.message : String(error)}`, timestamp: Date.now() });
    } finally {
      // **MUY IMPORTANTE: Liberar todas las Mats creadas**
      src?.delete();
      hsv?.delete();
      mask?.delete();
      contours?.delete();
      hierarchy?.delete();
      roiMask?.delete();
      maskedSrc?.delete();
    }
  }
}
