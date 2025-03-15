
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
    MIN_RED_THRESHOLD: 80,
    MAX_RED_THRESHOLD: 245,
    STABILITY_WINDOW: 4,
    MIN_STABILITY_COUNT: 3
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private readonly BUFFER_SIZE = 15;
  private readonly MIN_RED_THRESHOLD = 60;
  private readonly MAX_RED_THRESHOLD = 340;
  private readonly STABILITY_WINDOW = 5;
  private readonly MIN_STABILITY_COUNT = 3;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045;
  
  // Variables para el análisis de wavelet y periodicidad
  private baselineValue: number = 0;
  private readonly WAVELET_THRESHOLD = 0.025; // Umbral moderado para wavelets
  private readonly BASELINE_FACTOR = 0.95; // Factor de adaptación de línea base
  private periodicityBuffer: number[] = [];
  private readonly PERIODICITY_BUFFER_SIZE = 40; // Tamaño buffer para análisis de periodicidad
  private readonly MIN_PERIODICITY_SCORE = 0.3; // Puntuación mínima de periodicidad (moderada)
  
  // Nueva variable para el umbral de calidad de la señal (60%)
  private readonly SIGNAL_QUALITY_THRESHOLD = 60; // Umbral moderado para calidad de la señal

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada");
  }

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
    this.baselineValue = 0;
    this.periodicityBuffer = [];
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
      
      // Aplicar filtro wavelet adaptativo para reducir ruido
      const denoisedValue = this.applyWaveletDenoising(redValue);
      
      // Aplicar Kalman como segunda etapa de filtrado
      const filtered = this.kalmanFilter.filter(denoisedValue);
      
      // Almacenar para análisis de periodicidad
      this.periodicityBuffer.push(filtered);
      if (this.periodicityBuffer.length > this.PERIODICITY_BUFFER_SIZE) {
        this.periodicityBuffer.shift();
      }
      
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // Análisis mejorado de la señal con periodicidad
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);

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

  /**
   * Nuevo método: Aplica un filtro wavelet simple para reducir ruido
   * manteniendo características importantes de la señal PPG
   */
  private applyWaveletDenoising(value: number): number {
    // Inicializar valor baseline si es necesario
    if (this.baselineValue === 0) {
      this.baselineValue = value;
    } else {
      // Actualización adaptativa de la línea base
      this.baselineValue = this.baselineValue * this.BASELINE_FACTOR + 
                          value * (1 - this.BASELINE_FACTOR);
    }
    
    // Calcular diferencia respecto a la línea base
    const normalizedValue = value - this.baselineValue;
    
    // Aplicar umbral simple de wavelet (soft thresholding)
    // Si la diferencia es menor que el umbral, se considera ruido
    if (Math.abs(normalizedValue) < this.WAVELET_THRESHOLD) {
      return this.baselineValue; // Devolver la línea base (eliminar ruido)
    }
    
    // Reducir ligeramente la señal que supera el umbral (soft thresholding)
    const sign = normalizedValue >= 0 ? 1 : -1;
    const denoisedValue = sign * (Math.abs(normalizedValue) - this.WAVELET_THRESHOLD * 0.5);
    
    // Devolver el valor original con menor ruido
    return this.baselineValue + denoisedValue;
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
    
    // Análisis mejorado de variación para detectar picos
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Detección más sensible de picos cardíacos
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    // Umbrales adaptativos para mejor detección de picos
    const adaptiveThreshold = Math.max(1.5, avgValue * 0.02); // 2% del valor promedio
    const isStable = maxVariation < adaptiveThreshold * 2 && 
                    minVariation > -adaptiveThreshold * 2;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      // Reducción más gradual para mantener mejor la detección
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    // Integrar análisis de periodicidad en la detección
    const periodicityScore = this.analyzeSignalPeriodicity();
    
    // Calcular calidad de la señal
    let quality = 0;
    if (this.stableFrameCount >= this.MIN_STABILITY_COUNT) {
      // Cálculo de calidad mejorado con periodicidad
      const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - this.MIN_RED_THRESHOLD) / 
                                    (this.MAX_RED_THRESHOLD - this.MIN_RED_THRESHOLD), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 3)));
      
      // Integrar periodicidad en el cálculo de calidad (con peso moderado)
      quality = Math.round((stabilityScore * 0.35 + 
                          intensityScore * 0.25 + 
                          variationScore * 0.2 + 
                          periodicityScore * 0.2) * 100);
    }
    
    // Modificación: Ahora tomamos en cuenta el umbral de calidad de señal
    // para detectar el dedo. Se requiere una calidad mínima del 60%
    const isFingerDetected = this.stableFrameCount >= this.MIN_STABILITY_COUNT && 
                            periodicityScore > this.MIN_PERIODICITY_SCORE &&
                            quality >= this.SIGNAL_QUALITY_THRESHOLD;

    return { isFingerDetected, quality };
  }
  
  /**
   * Nuevo método: Analiza la periodicidad de la señal PPG
   * Las señales de pulso cardíaco tienen una periodicidad natural
   * Retorna puntuación de 0 a 1
   */
  private analyzeSignalPeriodicity(): number {
    // Si no tenemos suficientes datos, no podemos analizar periodicidad
    if (this.periodicityBuffer.length < 30) {
      return 0;
    }
    
    // Obtener los últimos valores para análisis
    const signal = this.periodicityBuffer.slice(-30);
    const signalMean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    
    // Normalizar señal
    const normalizedSignal = signal.map(val => val - signalMean);
    
    // Calcular autocorrelación para diferentes retrasos (lags)
    const maxLag = 20; // Máximo retraso a considerar
    const correlations: number[] = [];
    
    // Calcular la autocorrelación normalizada para cada retraso
    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0;
      let denominator = 0;
      
      for (let i = 0; i < normalizedSignal.length - lag; i++) {
        correlation += normalizedSignal[i] * normalizedSignal[i + lag];
        denominator += normalizedSignal[i] * normalizedSignal[i];
      }
      
      // Normalizar la correlación
      if (denominator > 0) {
        correlation /= Math.sqrt(denominator);
        correlations.push(Math.abs(correlation));
      } else {
        correlations.push(0);
      }
    }
    
    // Buscar picos en la autocorrelación (posibles períodos)
    let maxCorrelation = 0;
    let periodFound = false;
    
    // Considerar solo correlaciones que sean picos
    for (let i = 1; i < correlations.length - 1; i++) {
      // Es un pico si es mayor que los vecinos
      if (correlations[i] > correlations[i-1] && 
          correlations[i] > correlations[i+1] && 
          correlations[i] > 0.2) { // Umbral mínimo de correlación
          
        // Verificamos si está en el rango de frecuencia cardíaca (40-180 BPM)
        // Para 30 muestras a ~30 FPS, un período de 4-15 muestras es cardíaco
        if (i >= 4 && i <= 15) {
          if (correlations[i] > maxCorrelation) {
            maxCorrelation = correlations[i];
            periodFound = true;
          }
        }
      }
    }
    
    if (periodFound) {
      // Devolver una puntuación basada en la correlación máxima (0.2-1.0)
      return Math.min(1.0, maxCorrelation);
    } else {
      // Sin periodicidad clara
      return 0.1;
    }
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
