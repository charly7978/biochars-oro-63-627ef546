
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
    MIN_RED_THRESHOLD: 70,  // Reducido para mayor sensibilidad
    MAX_RED_THRESHOLD: 245,
    STABILITY_WINDOW: 4,
    MIN_STABILITY_COUNT: 3
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.035; // Ajustado para mejor sensibilidad
  private ppgBuffer: number[] = []; // Buffer para almacenar valores PPG
  private readonly MAX_BUFFER_SIZE = 300; // Tamaño máximo del buffer

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada con mayor sensibilidad");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.ppgBuffer = [];
      this.kalmanFilter.reset();
      console.log("PPGSignalProcessor: Inicializado con configuración optimizada");
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
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.ppgBuffer = [];
    this.kalmanFilter.reset();
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración");
      await this.initialize();
      
      // Ajustamos los umbrales basados en las condiciones actuales
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: Math.max(25, this.currentConfig.MIN_RED_THRESHOLD - 5),
        MAX_RED_THRESHOLD: Math.min(255, this.currentConfig.MAX_RED_THRESHOLD + 5)
      };

      console.log("PPGSignalProcessor: Calibración completada", this.currentConfig);
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Error de calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error durante la calibración");
      return false;
    }
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
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Almacenar en el buffer PPG para acceso externo
      this.ppgBuffer.push(filtered);
      if (this.ppgBuffer.length > this.MAX_BUFFER_SIZE) {
        this.ppgBuffer.shift();
      }
      
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);
      const perfusionIndex = this.calculatePerfusionIndex(this.lastValues);

      console.log("PPGSignalProcessor: Análisis", {
        redValue,
        filtered,
        isFingerDetected,
        quality,
        stableFrames: this.stableFrameCount,
        perfusionIndex
      });

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
    
    const avgRed = redSum / count;
    return avgRed;
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    // Si el valor está fuera del rango, NO hay dedo
    const isInRange = rawValue >= this.currentConfig.MIN_RED_THRESHOLD && 
                     rawValue <= this.currentConfig.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < this.currentConfig.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Mejora en la detección de estabilidad para picos cardíacos
    const recentValues = this.lastValues.slice(-this.currentConfig.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Análisis de variación para detectar picos
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Detección de picos cardíacos
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    // Umbrales adaptativos para detección de picos
    const adaptiveThreshold = Math.max(1.5, avgValue * 0.025);
    const isStable = maxVariation < adaptiveThreshold * 2 && 
                    minVariation > -adaptiveThreshold * 2;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.currentConfig.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

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

  private calculatePerfusionIndex(values: number[]): number {
    if (values.length < 5) return 0;
    
    const dc = values.reduce((a, b) => a + b, 0) / values.length;
    if (dc === 0) return 0;
    
    const ac = Math.max(...values) - Math.min(...values);
    return ac / dc;
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
  
  // Método para acceder al buffer PPG desde fuera
  getPPGBuffer(): number[] {
    return [...this.ppgBuffer];
  }
}
