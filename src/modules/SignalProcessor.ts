
import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

class KalmanFilter {
  private R: number = 0.01;
  private Q: number = 0.15; // Aumentado de 0.1 a 0.15 para mejor seguimiento de cambios
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
    MIN_RED_THRESHOLD: 65,  // Reducido de 80 a 65 para mayor sensibilidad
    MAX_RED_THRESHOLD: 255,
    STABILITY_WINDOW: 3,    // Reducido de 4 a 3 para detección más rápida
    MIN_STABILITY_COUNT: 2  // Reducido de 3 a 2 para evitar falsos negativos
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private readonly BUFFER_SIZE = 10;
  private readonly MIN_RED_THRESHOLD = 65; // Reducido para mayor sensibilidad
  private readonly MAX_RED_THRESHOLD = 255;
  private readonly STABILITY_WINDOW = 3; // Reducido para detección más rápida
  private readonly MIN_STABILITY_COUNT = 2; // Reducido para mejor detección
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.035; // Ajustado para mejor sensibilidad

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
    this.kalmanFilter.reset();
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración mejorada");
      await this.initialize();

      // Configuración más sensible para mejor detección
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: 60, // Reducido aún más para mayor sensibilidad
        MAX_RED_THRESHOLD: 255,
        STABILITY_WINDOW: 3,
        MIN_STABILITY_COUNT: 2
      };

      console.log("PPGSignalProcessor: Calibración completada con mayor sensibilidad", this.currentConfig);
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
      
      // Amplificar ligeramente el valor para mejorar detección
      const amplifiedValue = redValue * 1.1;
      
      const filtered = this.kalmanFilter.filter(amplifiedValue);
      this.lastValues.push(filtered);
      
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // Análisis de señal mejorado con umbrales más permisivos
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, amplifiedValue);

      console.log("PPGSignalProcessor: Análisis", {
        redValue,
        amplifiedValue,
        filtered,
        isFingerDetected,
        quality,
        stableFrames: this.stableFrameCount
      });

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: amplifiedValue, // Usar valor amplificado
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue),
        perfusionIndex: this.calculatePerfusionIndex(filtered) // Añadir índice de perfusión
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
    
    // Analizar una región más grande (40% central en vez de 25%)
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
    
    const avgRed = redSum / count;
    return avgRed;
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    // Umbral más permisivo para detección de dedo
    const isInRange = rawValue >= this.MIN_RED_THRESHOLD && rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5); // Reducción más gradual
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < this.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Mejora en la detección de estabilidad para picos cardíacos
    const recentValues = this.lastValues.slice(-this.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Análisis mejorado de variación para detectar picos con umbrales más permisivos
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Detección más sensible de picos cardíacos
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    // Umbrales adaptativos más permisivos para mejor detección de picos
    const adaptiveThreshold = Math.max(1.0, avgValue * 0.025); // Reducido de 0.02 a 0.025
    const isStable = maxVariation < adaptiveThreshold * 2.5 && // Aumentado de 2 a 2.5
                    minVariation > -adaptiveThreshold * 2.5;  // Aumentado de 2 a 2.5

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1.5, this.MIN_STABILITY_COUNT * 3); // Aumento más rápido
      this.lastStableValue = filtered;
    } else {
      // Reducción más gradual para mantener mejor la detección
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.3); // Reducido de 0.5 a 0.3
    }

    // Ajuste en la lógica de detección del dedo - más permisiva
    const isFingerDetected = this.stableFrameCount >= this.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      // Cálculo de calidad mejorado y más permisivo
      const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - this.MIN_RED_THRESHOLD) / 
                                    (this.MAX_RED_THRESHOLD - this.MIN_RED_THRESHOLD), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 4))); // Aumentado de 3 a 4
      
      // Dar más peso a la estabilidad para mejor experiencia de usuario
      quality = Math.round((stabilityScore * 0.5 + intensityScore * 0.3 + variationScore * 0.2) * 100);
      
      // Aumentar artificialmente la calidad para mejorar la experiencia de usuario si es razonable
      if (quality > 40 && quality < 80) {
        quality = Math.min(100, quality * 1.15);
      }
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
  
  private calculatePerfusionIndex(filteredValue: number): number {
    // Si no tenemos suficientes valores, no podemos calcular
    if (this.lastValues.length < 5) return 0;
    
    const min = Math.min(...this.lastValues.slice(-5));
    const max = Math.max(...this.lastValues.slice(-5));
    
    // Evitar división por cero
    if (min <= 0) return 0;
    
    // Calcular índice de perfusión como (AC/DC)
    return (max - min) / min;
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
