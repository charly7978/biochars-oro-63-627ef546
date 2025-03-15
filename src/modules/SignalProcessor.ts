
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
    MIN_RED_THRESHOLD: 75,
    MAX_RED_THRESHOLD: 230,
    STABILITY_WINDOW: 4,
    MIN_STABILITY_COUNT: 2
  };
  
  private currentConfig: typeof this.DEFAULT_CONFIG;
  
  // Parámetros de procesamiento
  private readonly BUFFER_SIZE = 15;
  private readonly MIN_RED_THRESHOLD = 75;
  private readonly MAX_RED_THRESHOLD = 230;
  private readonly STABILITY_WINDOW = 4;
  private readonly MIN_STABILITY_COUNT = 2;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  
  // Parámetros de análisis de calidad
  private readonly PERFUSION_INDEX_THRESHOLD = 0.055;
  private readonly SIGNAL_QUALITY_THRESHOLD = 55;
  
  // Análisis de periodicidad
  private baselineValue: number = 0;
  private readonly WAVELET_THRESHOLD = 0.025;
  private readonly BASELINE_FACTOR = 0.95;
  private periodicityBuffer: number[] = [];
  private readonly PERIODICITY_BUFFER_SIZE = 40;
  
  // Valor exigente para periodicidad para evitar falsos positivos
  private readonly MIN_PERIODICITY_SCORE = 0.45;
  
  // Variables para validación física de la señal
  private lastFramesVariation: number[] = []; 
  private readonly FRAMES_VARIATION_SIZE = 10;
  private readonly MIN_VALID_VARIATION = 0.18;
  private readonly MAX_STATIC_RATIO = 0.3;
  
  // NUEVA MEJORA: Variables para análisis de patrones de pulsación
  private pulsationPatternBuffer: number[] = [];
  private readonly PULSATION_BUFFER_SIZE = 30;
  private readonly PULSATION_FREQUENCY_MIN = 0.8;  // ~48 BPM
  private readonly PULSATION_FREQUENCY_MAX = 2.5;  // ~150 BPM
  
  // NUEVA MEJORA: Historial de intensidad de valores para fingerprint detection
  private intensityHistory: number[] = [];
  private readonly INTENSITY_HISTORY_SIZE = 20;
  private readonly MIN_INTENSITY_VARIATION = 4.0;
  
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
      this.lastFramesVariation = [];
      this.pulsationPatternBuffer = [];
      this.intensityHistory = [];
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
    this.lastFramesVariation = [];
    this.pulsationPatternBuffer = [];
    this.intensityHistory = [];
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
   * Procesa un frame para extraer información PPG
   */
  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Extraer canal rojo (principal para PPG)
      const redValue = this.extractRedChannel(imageData);
      
      // Aplicar denoising
      const denoisedValue = this.applyWaveletDenoising(redValue);
      
      // Filtrar con Kalman
      const filtered = this.kalmanFilter.filter(denoisedValue);
      
      // Registrar variación entre frames consecutivos
      this.trackFrameVariation(filtered);
      
      // Registrar los valores de intensidad (NUEVO)
      this.trackIntensityVariation(redValue);
      
      // Registrar el patrón de pulsación (NUEVO)
      this.trackPulsationPattern(filtered);
      
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

      // Analizar calidad y detección de dedo
      const { isFingerDetected, quality, physicalSignatureScore } = this.analyzeSignal(filtered, redValue);

      // Crear señal procesada
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue),
        physicalSignatureScore: physicalSignatureScore
      };

      // Enviar señal procesada
      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  /**
   * Seguimiento de variación entre frames para detectar señales vivas vs estáticas
   */
  private trackFrameVariation(value: number): void {
    if (this.lastValues.length > 0) {
      const lastValue = this.lastValues[this.lastValues.length - 1];
      const variation = Math.abs(value - lastValue);
      
      this.lastFramesVariation.push(variation);
      if (this.lastFramesVariation.length > this.FRAMES_VARIATION_SIZE) {
        this.lastFramesVariation.shift();
      }
    }
  }

  /**
   * NUEVO: Seguimiento de variación de intensidad en canal rojo
   * Esto ayuda a identificar cambios de volumen de sangre
   */
  private trackIntensityVariation(redValue: number): void {
    this.intensityHistory.push(redValue);
    if (this.intensityHistory.length > this.INTENSITY_HISTORY_SIZE) {
      this.intensityHistory.shift();
    }
  }

  /**
   * NUEVO: Seguimiento de patrones de pulsación para análisis de frecuencia
   */
  private trackPulsationPattern(value: number): void {
    this.pulsationPatternBuffer.push(value);
    if (this.pulsationPatternBuffer.length > this.PULSATION_BUFFER_SIZE) {
      this.pulsationPatternBuffer.shift();
    }
  }

  /**
   * MEJORADO: Evalúa si la señal tiene características físicas de un dedo real
   * Un dedo real muestra pulsaciones, variación de intensidad y patrones específicos
   */
  private analyzePhysicalSignature(): number {
    if (this.lastFramesVariation.length < this.FRAMES_VARIATION_SIZE * 0.5 ||
        this.intensityHistory.length < this.INTENSITY_HISTORY_SIZE * 0.5 ||
        this.pulsationPatternBuffer.length < this.PULSATION_BUFFER_SIZE * 0.5) {
      return 0;
    }
    
    // 1. Análisis de Variación Temporal
    const avgVariation = this.lastFramesVariation.reduce((sum, v) => sum + v, 0) / 
                         this.lastFramesVariation.length;
    
    const significantVariations = this.lastFramesVariation.filter(v => v > this.MIN_VALID_VARIATION).length;
    const variationRatio = significantVariations / this.lastFramesVariation.length;
    
    // 2. Análisis de Variación de Intensidad
    const maxIntensity = Math.max(...this.intensityHistory);
    const minIntensity = Math.min(...this.intensityHistory);
    const intensityRange = maxIntensity - minIntensity;
    
    // 3. Análisis de Frecuencia de Pulsación (FFT simplificado)
    const pulsationScore = this.analyzeSignalFrequencies();
    
    // 4. Análisis de Perfil de Cambio (derivada)
    const changeProfile = this.analyzeChangeProfile();
    
    // Combinar todos los factores para un score físico global
    // Cada factor tiene un peso diferente en la puntuación final
    const variationScore = (avgVariation > this.MIN_VALID_VARIATION * 0.7 && variationRatio > this.MAX_STATIC_RATIO) ? 
                          Math.min(1.0, avgVariation / (this.MIN_VALID_VARIATION * 2)) : 0;
    
    const intensityScore = intensityRange > this.MIN_INTENSITY_VARIATION ? 
                          Math.min(1.0, intensityRange / (this.MIN_INTENSITY_VARIATION * 3)) : 0;
    
    // Puntuación combinada - los pesos se ajustan para que los patrones de pulsación
    // sean el factor más importante
    const combinedScore = 
      variationScore * 0.25 + 
      intensityScore * 0.15 + 
      pulsationScore * 0.4 + 
      changeProfile * 0.2;
    
    console.log("PPGSignalProcessor: Análisis físico detallado", {
      variationScore,
      intensityScore,
      pulsationScore,
      changeProfile,
      combinedScore,
      timestamp: new Date().toISOString()
    });
    
    return combinedScore;
  }

  /**
   * NUEVO: Analiza las frecuencias en la señal para detectar componentes
   * en el rango de frecuencia cardíaca humana (aproximadamente 0.8-2.5 Hz)
   */
  private analyzeSignalFrequencies(): number {
    if (this.pulsationPatternBuffer.length < 25) {
      return 0;
    }

    // Implementación simplificada de detección de frecuencia principal
    // En una aplicación real se usaría FFT completa
    
    // 1. Normalizar la señal
    const mean = this.pulsationPatternBuffer.reduce((sum, val) => sum + val, 0) / 
                this.pulsationPatternBuffer.length;
    
    const normalizedSignal = this.pulsationPatternBuffer.map(val => val - mean);
    
    // 2. Autocorrelación para identificar periodicidad
    const maxLag = Math.min(20, Math.floor(this.pulsationPatternBuffer.length / 2));
    const correlations: number[] = [];
    
    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0;
      let denominator = 0;
      
      for (let i = 0; i < normalizedSignal.length - lag; i++) {
        correlation += normalizedSignal[i] * normalizedSignal[i + lag];
        denominator += normalizedSignal[i] * normalizedSignal[i];
      }
      
      correlations.push(denominator > 0 ? correlation / Math.sqrt(denominator) : 0);
    }
    
    // 3. Buscar pico de autocorrelación en el rango de frecuencia cardíaca
    // (típicamente 0.8-2.5 Hz, que corresponde a 48-150 BPM)
    let maxCorrelation = 0;
    let dominantPeriod = 0;
    
    for (let i = 1; i < correlations.length - 1; i++) {
      const isLocalPeak = correlations[i] > correlations[i-1] && 
                          correlations[i] > correlations[i+1];
      
      if (isLocalPeak && correlations[i] > maxCorrelation && correlations[i] > 0.15) {
        const period = i + 1;
        const frequency = 30 / period; // Aproximado, asumiendo 30 fps
        
        if (frequency >= this.PULSATION_FREQUENCY_MIN && 
            frequency <= this.PULSATION_FREQUENCY_MAX) {
          maxCorrelation = correlations[i];
          dominantPeriod = period;
        }
      }
    }
    
    // Si encontramos una periodicidad clara en el rango cardíaco, puntuación alta
    return dominantPeriod > 0 ? Math.min(1.0, maxCorrelation * 1.2) : 0.1;
  }

  /**
   * NUEVO: Analiza el perfil de cambio (derivada) para identificar patrones
   * característicos de pulsación cardíaca
   */
  private analyzeChangeProfile(): number {
    if (this.pulsationPatternBuffer.length < 15) {
      return 0;
    }
    
    // Calcular la primera derivada (tasa de cambio)
    const derivatives: number[] = [];
    for (let i = 1; i < this.pulsationPatternBuffer.length; i++) {
      derivatives.push(this.pulsationPatternBuffer[i] - this.pulsationPatternBuffer[i-1]);
    }
    
    // Analizar patrón típico de pulsación cardíaca:
    // Subida rápida (sístole) seguida de bajada más lenta (diástole)
    
    // Contar transiciones positivo-negativo (cambios de dirección)
    let directionChanges = 0;
    for (let i = 1; i < derivatives.length; i++) {
      if ((derivatives[i] > 0 && derivatives[i-1] < 0) || 
          (derivatives[i] < 0 && derivatives[i-1] > 0)) {
        directionChanges++;
      }
    }
    
    // Un buen perfil cardíaco tiene cambios de dirección regulares
    // pero no demasiados (ruido) ni muy pocos (señal estática)
    const expectedChanges = this.pulsationPatternBuffer.length / 8; // Aproximadamente
    const changeRatio = directionChanges / expectedChanges;
    
    // La puntuación es máxima cuando el ratio está cerca de 1
    return changeRatio > 0.7 && changeRatio < 1.3 ? 
           Math.max(0, 1 - Math.abs(1 - changeRatio)) : 
           Math.max(0, 0.5 - Math.abs(1 - changeRatio));
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
  private analyzeSignal(filtered: number, rawValue: number): { 
    isFingerDetected: boolean, 
    quality: number, 
    physicalSignatureScore: number
  } {
    const isInRange = rawValue >= this.MIN_RED_THRESHOLD && rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0, physicalSignatureScore: 0 };
    }

    if (this.lastValues.length < this.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0, physicalSignatureScore: 0 };
    }

    const recentValues = this.lastValues.slice(-this.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    // Umbral adaptativo con mayor tolerancia
    const adaptiveThreshold = Math.max(1.5, avgValue * 0.025);
    const isStable = maxVariation < adaptiveThreshold * 2.2 && 
                    minVariation > -adaptiveThreshold * 2.2;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1.2, this.MIN_STABILITY_COUNT * 3);
      this.lastStableValue = filtered;
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.4);
    }

    // CRÍTICO: Análisis físico para distinguir dedos reales de objetos estáticos
    const physicalSignatureScore = this.analyzePhysicalSignature();
    
    const periodicityScore = this.analyzeSignalPeriodicity();
    
    // Calculamos la calidad incluso con niveles bajos de estabilidad
    let quality = 0;
    
    if (this.stableFrameCount >= (this.MIN_STABILITY_COUNT * 0.8)) {
      const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - this.MIN_RED_THRESHOLD) / 
                                    (this.MAX_RED_THRESHOLD - this.MIN_RED_THRESHOLD), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 3)));
      
      // CRÍTICO: La calidad ahora depende FUERTEMENTE del score físico
      // Un objeto inanimado NUNCA debe tener calidad alta
      const physicalSignatureModifier = Math.pow(physicalSignatureScore, 1.5);
      
      // Cálculo de calidad más riguroso que penaliza señales no fisiológicas
      quality = Math.round((stabilityScore * 0.3 + 
                          intensityScore * 0.2 + 
                          variationScore * 0.2 + 
                          periodicityScore * 0.3) * 100 * physicalSignatureModifier);
    }
    
    // La detección de dedo ahora requiere un mínimo de características físicas
    // Un objeto estático NO DEBE ser detectado como dedo
    const isFingerDetected = this.stableFrameCount >= this.MIN_STABILITY_COUNT && 
                            periodicityScore > this.MIN_PERIODICITY_SCORE &&
                            physicalSignatureScore > 0.3;

    return { 
      isFingerDetected, 
      quality, 
      physicalSignatureScore 
    };
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
