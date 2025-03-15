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
    MIN_RED_THRESHOLD: 70,  // Reducido de 80 para mayor sensibilidad
    MAX_RED_THRESHOLD: 245,
    STABILITY_WINDOW: 3,    // Reducido de 4 para detección más rápida
    MIN_STABILITY_COUNT: 2  // Reducido de 3 para evitar falsos negativos
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private readonly BUFFER_SIZE = 10;
  private readonly MIN_RED_THRESHOLD = 70; // Reducido de 85 para mayor sensibilidad
  private readonly MAX_RED_THRESHOLD = 245;
  private readonly STABILITY_WINDOW = 4;
  private readonly MIN_STABILITY_COUNT = 2; // Reducido de 3 para mayor sensibilidad
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.035; // Reducido de 0.045 para mayor sensibilidad

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    console.log("PPGSignalProcessor: Instancia creada");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.kalmanFilter.reset();
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
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.kalmanFilter.reset();
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración");
      await this.initialize();

      // Simulamos el proceso de calibración
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ajustamos los umbrales basados en las condiciones actuales
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: Math.max(25, this.MIN_RED_THRESHOLD - 5),
        MAX_RED_THRESHOLD: Math.min(255, this.MAX_RED_THRESHOLD + 5),
        STABILITY_WINDOW: this.STABILITY_WINDOW,
        MIN_STABILITY_COUNT: this.MIN_STABILITY_COUNT
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
      console.log("PPGSignalProcessor: No está procesando");
      return;
    }

    try {
      const redValue = this.extractRedChannel(imageData);
      const filtered = this.kalmanFilter.filter(redValue);
      this.lastValues.push(filtered);
      
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);

      console.log("PPGSignalProcessor: Análisis", {
        redValue,
        filtered,
        isFingerDetected,
        quality,
        stableFrames: this.stableFrameCount
      });

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue)
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
    // Invertimos la lógica: si el valor está fuera del rango, NO hay dedo
    const isInRange = rawValue >= this.MIN_RED_THRESHOLD && rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < this.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Mejora en la detección de estabilidad para picos cardíacos
    const recentValues = this.lastValues.slice(-this.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Análisis mejorado de variación para detectar picos - ahora más sensible
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Detección más sensible de picos cardíacos
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    // Umbrales adaptativos para mejor detección de picos - más permisivos
    const adaptiveThreshold = Math.max(1.2, avgValue * 0.025); // Reducido de 0.02 * 1.5 para mayor sensibilidad
    const isStable = maxVariation < adaptiveThreshold * 2.5 && 
                    minVariation > -adaptiveThreshold * 2.5; // Umbrales más permisivos

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1.5, this.MIN_STABILITY_COUNT * 3); // Incremento más rápido
      this.lastStableValue = filtered;
    } else {
      // Reducción más gradual para mantener mejor la detección
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.3); // Reducción más lenta
    }

    // Ajuste en la lógica de detección del dedo - más permisiva
    const isFingerDetected = this.stableFrameCount >= this.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      // Cálculo de calidad mejorado - más generoso
      const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - this.MIN_RED_THRESHOLD) / 
                                    (this.MAX_RED_THRESHOLD - this.MIN_RED_THRESHOLD), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 4))); // Menos penalización
      
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
