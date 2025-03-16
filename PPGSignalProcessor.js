
import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';
import { SignalAmplifier } from '../modules/SignalAmplifier';

class KalmanFilter {
  private R: number = 0.008; // Reducido de 0.01 a 0.008 para menor ruido
  private Q: number = 0.12;  // Aumentado de 0.1 a 0.12 para mejor seguimiento de cambios rápidos
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
    BUFFER_SIZE: 12,  // Aumentado de 10 a 12 para mejor análisis espectral
    MIN_RED_THRESHOLD: 75,  // Reducido de 80 a 75 para mayor sensibilidad
    MAX_RED_THRESHOLD: 245,
    STABILITY_WINDOW: 4,
    MIN_STABILITY_COUNT: 2  // Reducido de 3 a 2 para detección más rápida
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private readonly BUFFER_SIZE = 12; // Actualizado
  private readonly MIN_RED_THRESHOLD = 75; // Actualizado
  private readonly MAX_RED_THRESHOLD = 245;
  private readonly STABILITY_WINDOW = 4;
  private readonly MIN_STABILITY_COUNT = 2; // Actualizado
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.04; // Reducido para mayor sensibilidad

  // Variables para adaptación dinámica
  private dynamicThreshold: number = 0;
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 20;
  private readonly ADAPTATION_RATE = 0.15; // Tasa de adaptación para umbrales dinámicos
  
  // Nuevo: Amplificador de señal para mejoras adicionales
  private signalAmplifier: SignalAmplifier;
  private lastAmplifiedValue: number = 0;
  private signalQuality: number = 0;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    this.signalAmplifier = new SignalAmplifier();
    console.log("PPGSignalProcessor: Instancia creada con amplificador de señal integrado");
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.kalmanFilter.reset();
      this.signalHistory = [];
      this.dynamicThreshold = 0;
      this.signalAmplifier.reset();
      this.lastAmplifiedValue = 0;
      this.signalQuality = 0;
      console.log("PPGSignalProcessor: Inicializado con amplificador de señal");
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
    this.signalHistory = [];
    this.dynamicThreshold = 0;
    this.signalAmplifier.reset();
    this.lastAmplifiedValue = 0;
    this.signalQuality = 0;
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
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Aplicar amplificador de señal avanzado
      const { amplifiedValue, quality } = this.signalAmplifier.processValue(filtered);
      this.lastAmplifiedValue = amplifiedValue;
      this.signalQuality = quality;
      
      // Guardar el valor amplificado en el buffer
      this.lastValues.push(amplifiedValue);
      
      // Actualizar historial para adaptación dinámica
      this.signalHistory.push(amplifiedValue);
      if (this.signalHistory.length > this.HISTORY_SIZE) {
        this.signalHistory.shift();
      }
      
      // Actualizar umbral dinámico si tenemos suficientes datos
      if (this.signalHistory.length >= this.HISTORY_SIZE / 2) {
        this.updateDynamicThreshold();
      }
      
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // Análisis con valor amplificado
      const { isFingerDetected, quality: detectionQuality } = this.analyzeSignal(amplifiedValue, redValue);

      // Beneficiarse de la calidad del amplificador
      const perfusionIndex = this.calculatePerfusionIndex();
      const combinedQuality = Math.round((detectionQuality * 0.7 + this.signalQuality * 100 * 0.3));

      console.log("PPGSignalProcessor: Análisis con amplificador", {
        redValue,
        filtered,
        amplifiedValue,
        isFingerDetected,
        detectionQuality,
        amplifierQuality: this.signalQuality,
        combinedQuality,
        stableFrames: this.stableFrameCount,
        perfusionIndex,
        dynamicThreshold: this.dynamicThreshold,
        amplifierGain: this.signalAmplifier.getCurrentGain()
      });

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: amplifiedValue, // Usamos el valor amplificado
        quality: combinedQuality, // Calidad mejorada
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue),
        perfusionIndex
      };

      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private updateDynamicThreshold(): void {
    const min = Math.min(...this.signalHistory);
    const max = Math.max(...this.signalHistory);
    const range = max - min;
    
    // Calcular nuevo umbral basado en el rango de la señal
    const newThreshold = range * 0.25; // 25% del rango como umbral
    
    // Actualizar dinámicamente con suavizado
    if (this.dynamicThreshold === 0) {
      this.dynamicThreshold = newThreshold;
    } else {
      this.dynamicThreshold = (1 - this.ADAPTATION_RATE) * this.dynamicThreshold + 
                             this.ADAPTATION_RATE * newThreshold;
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
    
    // Analizar solo el centro de la imagen (30% central en lugar de 25%)
    const startX = Math.floor(imageData.width * 0.35);
    const endX = Math.floor(imageData.width * 0.65);
    const startY = Math.floor(imageData.height * 0.35);
    const endY = Math.floor(imageData.height * 0.65);
    
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
    // Usar umbral dinámico para mejor adaptación
    const effectiveThreshold = this.dynamicThreshold > 0 ? 
                              this.dynamicThreshold : 
                              this.MIN_RED_THRESHOLD;
                              
    // Verificar si el valor está en rango
    const isInRange = rawValue >= effectiveThreshold && rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < this.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Análisis mejorado con señal amplificada
    const recentValues = this.lastValues.slice(-this.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Análisis mejorado de variación para detectar picos
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Usar la calidad del amplificador para ajustar los umbrales
    const qualityFactor = 0.8 + (this.signalQuality * 0.4); // 0.8-1.2
    
    // Detección más sensible de picos cardíacos
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    // Umbrales adaptativos con influencia del amplificador
    const adaptiveThreshold = Math.max(1.2, avgValue * 0.018 * qualityFactor);
    const isStable = maxVariation < adaptiveThreshold * 2.2 && 
                    minVariation > -adaptiveThreshold * 2.2;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      // Reducción más gradual para mantener mejor la detección
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.4);
    }

    // Beneficio de la calidad del amplificador para detección
    const isFingerDetected = this.stableFrameCount >= this.MIN_STABILITY_COUNT || this.signalQuality > 0.7;
    
    let quality = 0;
    if (isFingerDetected) {
      // Cálculo de calidad mejorado con amplificador
      const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - effectiveThreshold) / 
                                    (this.MAX_RED_THRESHOLD - effectiveThreshold), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 3)));
      const amplifierScore = this.signalQuality;
      
      // Ponderación con mayor peso al amplificador
      quality = Math.round((
        stabilityScore * 0.3 + 
        intensityScore * 0.3 + 
        variationScore * 0.2 + 
        amplifierScore * 0.2
      ) * 100);
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
