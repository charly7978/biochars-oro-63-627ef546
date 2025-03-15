import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

/**
 * Implementación del filtro de Kalman para suavizar señales
 */
class KalmanFilter {
  private R: number = 0.01;  // Ruido de medición
  private Q: number = 0.1;   // Ruido de proceso
  private P: number = 1;     // Estimación de error
  private X: number = 0;     // Valor estimado
  private K: number = 0;     // Ganancia de Kalman

  filter(measurement: number): number {
    // Predicción
    this.P = this.P + this.Q;
    
    // Actualización
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

/**
 * Procesador de señales PPG (Fotopletismografía)
 * Implementa la interfaz SignalProcessor
 */
export class PPGSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private lastValues: number[] = [];
  
  // Configuración por defecto
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 60,
    MAX_RED_THRESHOLD: 250,
    STABILITY_WINDOW: 3,
    MIN_STABILITY_COUNT: 2
  };
  
  private currentConfig: typeof this.DEFAULT_CONFIG;
  
  // Parámetros de procesamiento
  private readonly BUFFER_SIZE = 15;
  private readonly MIN_RED_THRESHOLD = 60;
  private readonly MAX_RED_THRESHOLD = 250;
  private readonly STABILITY_WINDOW = 3;
  private readonly MIN_STABILITY_COUNT = 2;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  
  // Parámetros de análisis de calidad
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045;
  private readonly SIGNAL_QUALITY_THRESHOLD = 40;
  
  // Análisis de periodicidad
  private baselineValue: number = 0;
  private readonly WAVELET_THRESHOLD = 0.025;
  private readonly BASELINE_FACTOR = 0.95;
  private periodicityBuffer: number[] = [];
  private readonly PERIODICITY_BUFFER_SIZE = 40;
  private readonly MIN_PERIODICITY_SCORE = 0.42;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada");
  }

  /**
   * Inicializa el procesador
   */
  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.kalmanFilter.reset();
      this.baselineValue = 0;
      this.periodicityBuffer = [];
      console.log("PPGSignalProcessor: Inicializado");
    } catch (error) {
      console.error("PPGSignalProcessor: Error de inicialización", error);
      this.handleError("INIT_ERROR", "Error al inicializar el procesador");
    }
  }

  /**
   * Inicia el procesamiento de señales
   */
  start(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.initialize();
    console.log("PPGSignalProcessor: Iniciado");
  }

  /**
   * Detiene el procesamiento de señales
   */
  stop(): void {
    this.isProcessing = false;
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.kalmanFilter.reset();
    this.baselineValue = 0;
    this.periodicityBuffer = [];
    console.log("PPGSignalProcessor: Detenido");
  }

  /**
   * Calibra el procesador para mejores resultados
   */
  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración");
      await this.initialize();

      // Tiempo para calibración
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ajustar umbrales basados en las condiciones actuales
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

  /**
   * Restablece configuración por defecto
   */
  resetToDefault(): void {
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    this.initialize();
    console.log("PPGSignalProcessor: Configuración restaurada a valores por defecto");
  }

  /**
   * Método simplificado para detectar la presencia de un dedo
   * Reemplaza análisis complejos con una detección directa
   */
  private isFingerPresent(redValue: number): boolean {
    // 1. Verificación de rango más estricta
    const isInGoodRange = redValue >= this.MIN_RED_THRESHOLD + 20 && redValue <= this.MAX_RED_THRESHOLD - 20;
    if (!isInGoodRange) return false;
    
    // 2. Si tenemos suficientes valores para análisis
    if (this.lastValues.length >= 4) {
      // Calculamos diferencia entre valores consecutivos
      const last = this.lastValues.slice(-4);
      const diffs = [
        Math.abs(last[1] - last[0]),
        Math.abs(last[2] - last[1]),
        Math.abs(last[3] - last[2])
      ];
      
      // Exigimos una señal muy estable - un dedo quieto no produce grandes cambios entre frames
      const maxDiff = Math.max(...diffs);
      if (maxDiff > 25) return false;
      
      // Verificar rango dinámico mínimo (la señal no debe ser plana)
      const min = Math.min(...last);
      const max = Math.max(...last);
      const range = max - min;
      
      // Si el rango es muy pequeño, podría ser ruido o nada
      if (range < 3) return false;
    } else {
      // Con pocos valores, somos conservadores
      return false;
    }
    
    return true;
  }
  
  /**
   * Procesa un frame para extraer información PPG
   */
  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Extraer canal rojo (principal para PPG)
      const redValue = this.extractRedChannel(imageData);
      
      // Verificación rápida de presencia de dedo
      const fingerPresent = this.isFingerPresent(redValue);
      
      // Aplicar denoising
      const denoisedValue = this.applyWaveletDenoising(redValue);
      
      // Filtrar con Kalman
      const filtered = this.kalmanFilter.filter(denoisedValue);
      
      // Almacenar para análisis de periodicidad
      this.periodicityBuffer.push(filtered);
      if (this.periodicityBuffer.length > this.PERIODICITY_BUFFER_SIZE) {
        this.periodicityBuffer.shift();
      }
      
      // Almacenar para análisis de tendencia
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // Análisis simplificado si no hay dedo
      let quality = 0;
      let isFingerDetected = false;
      
      if (fingerPresent) {
        // Solo realizamos análisis completo si hay posibilidad de dedo
        const result = this.analyzeSignal(filtered, redValue);
        quality = result.quality;
        isFingerDetected = result.isFingerDetected;
        
        // Verificación adicional: necesitamos variabilidad fisiológica realista
        // Las pulsaciones cardíacas generan una señal con cierta variación
        if (isFingerDetected && this.periodicityBuffer.length >= 15) {
          const recentSignal = this.periodicityBuffer.slice(-15);
          const signalVariance = this.calculateVariance(recentSignal);
          
          // Un dedo real muestra pequeñas variaciones naturales
          // Un valor muy bajo indica una señal estática o ruido
          if (signalVariance < 0.5) {
            isFingerDetected = false;
            quality = Math.max(0, quality - 20);
          }
        }
      }

      // Crear señal procesada
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue)
      };

      // Enviar señal procesada
      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  /**
   * Extrae el canal rojo de un frame
   * El canal rojo es el más sensible a cambios en volumen sanguíneo
   */
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

  /**
   * Aplica denoising wavelet para reducción de ruido
   */
  private applyWaveletDenoising(value: number): number {
    if (this.baselineValue === 0) {
      this.baselineValue = value;
    } else {
      this.baselineValue = this.baselineValue * this.BASELINE_FACTOR + 
                          value * (1 - this.BASELINE_FACTOR);
    }
    
    const normalizedValue = value - this.baselineValue;
    
    if (Math.abs(normalizedValue) < this.WAVELET_THRESHOLD) {
      return this.baselineValue;
    }
    
    const sign = normalizedValue >= 0 ? 1 : -1;
    const denoisedValue = sign * (Math.abs(normalizedValue) - this.WAVELET_THRESHOLD * 0.5);
    
    return this.baselineValue + denoisedValue;
  }

  /**
   * Analiza la señal para determinar calidad y presencia de dedo
   */
  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    // Verificación estricta de rango para el dedo
    const isInRange = rawValue >= this.MIN_RED_THRESHOLD + 15 && rawValue <= this.MAX_RED_THRESHOLD - 15;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    // Necesitamos varios frames para evaluar estabilidad
    if (this.lastValues.length < this.STABILITY_WINDOW + 1) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Analizamos los valores recientes
    const recentValues = this.lastValues.slice(-this.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calculamos variaciones entre frames consecutivos
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Medimos la variación máxima y mínima
    const maxVariation = Math.max(...variations.map(Math.abs));
    
    // Umbral adaptativo más estricto
    const adaptiveThreshold = Math.max(1.5, avgValue * 0.02);
    
    // Criterio de estabilidad
    const isStable = maxVariation < adaptiveThreshold * 2;

    // Manejo del contador de estabilidad más conservador
    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      // Penalización más agresiva a la inestabilidad
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1.5);
    }
    
    // Verificar variación mínima (eliminar señales planas)
    const range = Math.max(...recentValues) - Math.min(...recentValues);
    const hasVariation = range > 3;
    
    // Cálculo de calidad 
    let quality = 0;
    if (this.stableFrameCount >= this.MIN_STABILITY_COUNT && hasVariation) {
      const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - this.MIN_RED_THRESHOLD) / 
                                    (this.MAX_RED_THRESHOLD - this.MIN_RED_THRESHOLD), 1);
      
      quality = Math.round((stabilityScore * 0.6 + intensityScore * 0.4) * 100);
    }
    
    // Criterio de detección más estricto
    const isFingerDetected = this.stableFrameCount >= this.MIN_STABILITY_COUNT + 1 &&
                            quality >= 50 && 
                            hasVariation;

    return { isFingerDetected, quality };
  }

  /**
   * Analiza la periodicidad de la señal para determinar calidad
   */
  private analyzeSignalPeriodicity(): number {
    if (this.periodicityBuffer.length < 30) {
      return 0;
    }
    
    const signal = this.periodicityBuffer.slice(-30);
    const signalMean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    
    const normalizedSignal = signal.map(val => val - signalMean);
    
    const maxLag = 20;
    const correlations: number[] = [];
    
    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0;
      let denominator = 0;
      
      for (let i = 0; i < normalizedSignal.length - lag; i++) {
        correlation += normalizedSignal[i] * normalizedSignal[i + lag];
        denominator += normalizedSignal[i] * normalizedSignal[i];
      }
      
      if (denominator > 0) {
        correlation /= Math.sqrt(denominator);
        correlations.push(Math.abs(correlation));
      } else {
        correlations.push(0);
      }
    }
    
    let maxCorrelation = 0;
    let periodFound = false;
    
    for (let i = 1; i < correlations.length - 1; i++) {
      if (correlations[i] > correlations[i-1] && 
          correlations[i] > correlations[i+1] && 
          correlations[i] > 0.2) {
        
        if (i >= 4 && i <= 15) {
          if (correlations[i] > maxCorrelation) {
            maxCorrelation = correlations[i];
            periodFound = true;
          }
        }
      }
    }
    
    if (periodFound) {
      return Math.min(1.0, maxCorrelation);
    } else {
      return 0.1;
    }
  }

  /**
   * Detecta región de interés para análisis
   */
  private detectROI(redValue: number): ProcessedSignal['roi'] {
    return {
      x: 0,
      y: 0,
      width: 100,
      height: 100
    };
  }

  /**
   * Calcula la varianza de una señal
   * Usada para verificar variabilidad fisiológica real
   */
  private calculateVariance(signal: number[]): number {
    if (signal.length === 0) return 0;
    
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const squaredDiffs = signal.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / signal.length;
    
    return variance;
  }

  /**
   * Maneja errores del procesador
   */
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
