import { KalmanFilter } from '../../modules/vital-signs/shared-signal-utils';
import { WaveletDenoiser } from './filters/WaveletDenoiser';
import { ProcessingError, ProcessedSignal } from '../../types/signal';

export class PPGProcessor {
  // Configuración unificada con valores optimizados
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
  
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private waveletDenoiser: WaveletDenoiser;
  private lastValues: number[] = [];
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private baselineValue: number = 0;
  private periodicityBuffer: number[] = [];
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.waveletDenoiser = new WaveletDenoiser();
    console.log("PPGProcessor: Instancia unificada creada");
  }

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
      console.log("PPGProcessor: Calibración completada");
      resolve(true);
    });
  }

  public processFrame(imageData: ImageData): void {
    if (!this.isProcessing) return;
    
    if (!this.kalmanFilter || !this.waveletDenoiser) {
        this.handleError('not_initialized', 'PPGProcessor filters not initialized.');
        return;
    }

    const rawValue = this.extractRedChannel(imageData);

    // Apply filters
    const kalmanFiltered = this.kalmanFilter.filter(rawValue);
    const denoisedValue = this.waveletDenoiser.denoise(kalmanFiltered);
    
    // Store filtered value for analysis
    this.lastValues.push(denoisedValue);
    if (this.lastValues.length > this.CONFIG.BUFFER_SIZE) {
      this.lastValues.shift();
    }

    const { isFingerDetected, quality } = this.analyzeSignal(denoisedValue, rawValue);
    const perfusionIndex = this.calculatePerfusionIndex();

    this.periodicityBuffer.push(denoisedValue);
    if (this.periodicityBuffer.length > this.CONFIG.PERIODICITY_BUFFER_SIZE) {
      this.periodicityBuffer.shift();
    }

    const processedSignal: ProcessedSignal = {
      timestamp: Date.now(),
      rawValue,
      filteredValue: denoisedValue,
      quality,
      fingerDetected: isFingerDetected,
      roi: this.detectROI(rawValue),
      perfusionIndex,
      value: denoisedValue,
    };

    this.onSignalReady?.(processedSignal);
  }

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

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const isInRange = rawValue >= this.CONFIG.MIN_RED_THRESHOLD && 
                      rawValue <= this.CONFIG.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < this.CONFIG.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    const recentValues = this.lastValues.slice(-this.CONFIG.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    const maxVariation = Math.max(...variations.map(Math.abs));
    const adaptiveThreshold = Math.max(1.5, avgValue * 0.02);
    const isStable = maxVariation < adaptiveThreshold * 2;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.CONFIG.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    const isFingerDetected = this.stableFrameCount >= this.CONFIG.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      // Calcular calidad basada en estabilidad y periodicidad
      const stabilityQuality = (this.stableFrameCount / (this.CONFIG.MIN_STABILITY_COUNT * 2)) * 50;
      const periodicityQuality = this.analyzePeriodicityQuality() * 50;
      quality = Math.round(stabilityQuality + periodicityQuality);
    }

    return { isFingerDetected, quality };
  }

  private calculatePerfusionIndex(): number {
    if (this.lastValues.length < 10) return 0;
    
    const values = this.lastValues.slice(-10);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const dc = (max + min) / 2;
    
    if (dc === 0) return 0;
    
    const ac = max - min;
    const pi = (ac / dc) * 100;
    
    return Math.min(pi, 10); // Limitar a un máximo razonable de 10%
  }

  private analyzePeriodicityQuality(): number {
    if (this.periodicityBuffer.length < 30) return 0.5;
    
    const mean = this.periodicityBuffer.reduce((sum, val) => sum + val, 0) / this.periodicityBuffer.length;
    const variance = this.periodicityBuffer.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.periodicityBuffer.length;
    const quality = Math.max(0, 100 - Math.min(100, variance * 1000));
    return quality;
  }

  private detectROI(redValue: number): ProcessedSignal['roi'] {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  private handleError(code: string, message: string): void {
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    
    this.onError?.(error);
  }
}
