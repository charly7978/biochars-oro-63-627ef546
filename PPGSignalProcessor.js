
import { ProcessedSignal, ProcessingError, SignalProcessor } from './src/types/signal';
import { SignalAmplifier } from './src/modules/SignalAmplifier';
import { fingerDetectionService } from './src/core/FingerDetectionService';

class KalmanFilter {
  private R: number = 0.008; // Noise reduction factor
  private Q: number = 0.12;  // Process noise
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
    BUFFER_SIZE: 12,
    MIN_RED_THRESHOLD: 85,
    MAX_RED_THRESHOLD: 245
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  
  // Signal amplifier 
  private signalAmplifier: SignalAmplifier;
  private lastAmplifiedValue: number = 0;
  private signalQuality: number = 0;
  
  // Variables for baseline establishment
  private baselineValues: number[] = [];
  private readonly BASELINE_SIZE = 10;
  private hasEstablishedBaseline: boolean = false;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    this.signalAmplifier = new SignalAmplifier();
    console.log("PPGSignalProcessor: Instancia creada");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.kalmanFilter.reset();
      this.signalAmplifier.reset();
      this.lastAmplifiedValue = 0;
      this.signalQuality = 0;
      this.baselineValues = [];
      this.hasEstablishedBaseline = false;
      fingerDetectionService.reset();
      console.log("PPGSignalProcessor: Inicializado");
    } catch (error) {
      console.error("PPGSignalProcessor: Error de inicialización", error);
      this.handleError("INIT_ERROR", "Error al inicializar el procesador");
    }
  }

  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Iniciado");
  }

  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.kalmanFilter.reset();
    this.signalAmplifier.reset();
    this.lastAmplifiedValue = 0;
    this.signalQuality = 0;
    this.baselineValues = [];
    this.hasEstablishedBaseline = false;
    fingerDetectionService.reset();
    console.log("PPGSignalProcessor: Detenido");
  }

  resetToDefault(): void {
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    this.initialize();
    console.log("PPGSignalProcessor: Configuración restaurada a valores por defecto");
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      console.log("PPGSignalProcessor: No está procesando");
      return;
    }

    try {
      const redValue = this.extractRedChannel(imageData);
      
      // Establish baseline for better false positive rejection
      if (!this.hasEstablishedBaseline) {
        this.baselineValues.push(redValue);
        if (this.baselineValues.length > this.BASELINE_SIZE) {
          this.baselineValues.shift();
          this.hasEstablishedBaseline = true;
          
          // Calculate baseline stats
          const baselineAvg = this.baselineValues.reduce((sum, val) => sum + val, 0) / this.baselineValues.length;
          const baselineVar = this.baselineValues.reduce((sum, val) => sum + Math.pow(val - baselineAvg, 2), 0) / this.baselineValues.length;
          console.log("PPGSignalProcessor: Baseline established", { baselineAvg, baselineVar });
        }
        
        // Return early with not-detected status during baseline collection
        if (!this.hasEstablishedBaseline) {
          if (this.onSignalReady) {
            this.onSignalReady({
              timestamp: Date.now(),
              rawValue: redValue,
              filteredValue: 0,
              quality: 0,
              fingerDetected: false,
              roi: this.detectROI(redValue),
              perfusionIndex: 0
            });
          }
          return;
        }
      }
      
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Apply signal amplifier
      const { amplifiedValue, quality } = this.signalAmplifier.processValue(filtered);
      this.lastAmplifiedValue = amplifiedValue;
      this.signalQuality = quality;
      
      // Save amplified value in buffer
      this.lastValues.push(amplifiedValue);
      
      if (this.lastValues.length > this.DEFAULT_CONFIG.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // Calculate perfusion index
      const perfusionIndex = this.calculatePerfusionIndex();
      
      // Create initial processed signal
      let processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: amplifiedValue,
        quality: Math.round(quality * 100),
        fingerDetected: redValue >= this.currentConfig.MIN_RED_THRESHOLD && 
                        redValue <= this.currentConfig.MAX_RED_THRESHOLD,
        roi: this.detectROI(redValue),
        perfusionIndex
      };
      
      // Use unified finger detection service
      processedSignal = fingerDetectionService.processSignal(processedSignal);

      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private calculatePerfusionIndex(): number {
    if (this.lastValues.length < 5) return 0;
    
    const recent = this.lastValues.slice(-5);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    
    // PI = (AC/DC)
    const ac = max - min;
    const dc = (max + min) / 2;
    
    return dc > 0 ? ac / dc : 0;
  }

  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    // Only analyze the center of the image (30% central)
    const startX = Math.floor(imageData.width * 0.35);
    const endX = Math.floor(imageData.width * 0.65);
    const startY = Math.floor(imageData.height * 0.35);
    const endY = Math.floor(imageData.height * 0.65);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];  // Red channel
        count++;
      }
    }
    
    const avgRed = redSum / count;
    return avgRed;
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
