// Remove KalmanFilter and WaveletDenoiser imports as they won't be used here anymore
// import { KalmanFilter } from '@/utils/vitalSignsUtils';
// import { WaveletDenoiser } from './filters/WaveletDenoiser';
// Keep ProcessedSignal and ProcessingError for callback types, but ProcessedSignal won't be fully constructed here
import type { ProcessedSignal, ProcessingError } from '../../types/signal';

export class PPGProcessor {
  // Remove internal config and state related to filtering/quality/detection
  /*
  private readonly CONFIG = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 60,
    MAX_RED_THRESHOLD: 230,
    STABILITY_WINDOW: 3,
    MIN_STABILITY_COUNT: 3,
    PERFUSION_INDEX_THRESHOLD: 0.05,
    WAVELET_THRESHOLD: 0.025,
    BASELINE_FACTOR: 0.95,
    PERIODICITY_BUFFER_SIZE: 40,
    MIN_PERIODICITY_SCORE: 0.3,
    SIGNAL_QUALITY_THRESHOLD: 65
  };
  */

  private isProcessing: boolean = false;
  // Remove filter instances and state
  // private kalmanFilter: KalmanFilter;
  // private waveletDenoiser: WaveletDenoiser;
  // private lastValues: number[] = [];
  // private stableFrameCount: number = 0;
  // private lastStableValue: number = 0;
  // private baselineValue: number = 0;
  // private periodicityBuffer: number[] = [];

  constructor(
    // Modify the callback to expect just the raw value
    public onRawValueReady?: (rawValue: number) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    // Remove filter initialization
    // this.kalmanFilter = new KalmanFilter();
    // this.waveletDenoiser = new WaveletDenoiser();
    console.log("PPGProcessor: Instancia simplificada creada (solo extracción)");
  }

  // initialize, start, stop, calibrate remain the same
  public initialize(): Promise<void> {
    return new Promise<void>((resolve) => {
      console.log("PPGProcessor: Inicializado");
      resolve();
    });
  }

  public start(): void {
    this.isProcessing = true;
    console.log("PPGProcessor: Procesamiento iniciado");
  }

  public stop(): void {
    this.isProcessing = false;
    console.log("PPGProcessor: Procesamiento detenido");
  }

  public calibrate(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      console.log("PPGProcessor: Calibración completada (no-op en modo extracción)");
      resolve(true);
    });
  }


  public processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Step 1: Extract raw red channel value
      const redValue = this.extractRedChannel(imageData);

      // Step 2: Emit the raw value via callback
      this.onRawValueReady?.(redValue);

      // Remove filtering, analysis, and complex signal construction
      /*
      const kalmanFiltered = this.kalmanFilter.filter(redValue);
      const filtered = this.waveletDenoiser.denoise(kalmanFiltered);
      
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.CONFIG.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);
      const perfusionIndex = this.calculatePerfusionIndex();

      this.periodicityBuffer.push(filtered);
      if (this.periodicityBuffer.length > this.CONFIG.PERIODICITY_BUFFER_SIZE) {
        this.periodicityBuffer.shift();
      }

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue),
        perfusionIndex: perfusionIndex
      };

      this.onSignalReady?.(processedSignal);
      */

    } catch (error) {
      console.error("PPGProcessor: Error extrayendo valor", error);
      this.handleError("EXTRACTION_ERROR", "Error al extraer valor de imagen");
    }
  }

  // extractRedChannel remains the same
  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    // Analizar el 40% central de la imagen para mejor precisión
    const startX = Math.floor(imageData.width * 0.3);
    const endX = Math.floor(imageData.width * 0.7);
    const startY = Math.floor(imageData.height * 0.3);
    const endY = Math.floor(imageData.height * 0.7);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];  // Canal rojo
        count++;
      }
    }
    
    return redSum / count;
  }

  // Remove analyzeSignal, calculatePerfusionIndex, analyzePeriodicityQuality, detectROI
  /*
  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } { ... }
  private calculatePerfusionIndex(): number { ... }
  private analyzePeriodicityQuality(): number { ... }
  private detectROI(redValue: number): ProcessedSignal['roi'] { ... }
  */

  // handleError remains the same
  private handleError(code: string, message: string): void {
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    
    this.onError?.(error);
  }
}
