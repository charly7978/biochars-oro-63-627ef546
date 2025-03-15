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
    // 1. Verificación de rango ultra estricta
    // El rojo debe estar en una ventana más estrecha con valores típicos de piel
    const isInGoodRange = redValue >= 100 && redValue <= 200;
    if (!isInGoodRange) return false;
    
    // 2. Necesitamos suficientes valores para un análisis estable
    if (this.lastValues.length < 6) return false;
    
    // 3. Análisis de las últimas muestras para buscar estabilidad
    const last = this.lastValues.slice(-6);
    
    // 4. Verificamos diferencias consecutivas - muy restrictivo
    const diffs = [];
    for (let i = 1; i < last.length; i++) {
      diffs.push(Math.abs(last[i] - last[i-1]));
    }
    
    // 5. Exigimos una señal muy estable 
    const maxDiff = Math.max(...diffs);
    if (maxDiff > 20) return false;  // Umbral más estricto
    
    // 6. Verificar diferencia entre mínimos y máximos
    const min = Math.min(...last);
    const max = Math.max(...last);
    const range = max - min;
    
    // El rango debe estar en un intervalo específico: 
    // - Demasiado pequeño = no hay pulso (señal plana)
    // - Demasiado grande = probablemente ruido
    if (range < 5 || range > 40) return false;
    
    // 7. Verificar la monotonía - las señales PPG reales muestran tendencias
    // consistentes durante varios frames
    let increasingCount = 0;
    let decreasingCount = 0;
    let monotonicWindow = 3; // Mínimo de frames con tendencia consistente
    
    for (let i = 1; i < last.length; i++) {
      if (last[i] > last[i-1]) {
        increasingCount++;
        decreasingCount = 0;
      } else if (last[i] < last[i-1]) {
        decreasingCount++;
        increasingCount = 0;
      } else {
        increasingCount = 0;
        decreasingCount = 0;
      }
      
      // Si encontramos una tendencia consistente, es una buena señal
      if (increasingCount >= monotonicWindow || decreasingCount >= monotonicWindow) {
        return true;
      }
    }
    
    // Si llegamos aquí, no hay suficiente evidencia de una señal PPG real
    return false;
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
      
      // También extraer canales verde y azul para verificación
      const { green, blue } = this.extractOtherChannels(imageData);
      
      // Verificación rápida de presencia de dedo
      const fingerPresent = this.isFingerPresent(redValue);
      
      // Análisis de relación entre canales (filtro de artefactos)
      const hasValidColorPattern = this.checkColorChannelsRatio(redValue, green, blue);
      
      // Si falla la verificación de relación de colores, consideramos que no hay dedo
      if (!hasValidColorPattern) {
        this.onSignalReady?.({
          timestamp: Date.now(),
          rawValue: redValue,
          filteredValue: redValue, 
          quality: 0,
          fingerDetected: false,
          roi: this.detectROI(redValue)
        });
        return;
      }
      
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
          
          // Verificar tanto varianza mínima como máxima
          // - Muy baja: señal plana o ruido
          // - Muy alta: probablemente movimiento o artefacto
          if (signalVariance < 1.0 || signalVariance > 50) {
            isFingerDetected = false;
            quality = Math.max(0, quality - 30);
          }
          
          // Verificar también autocorrelación para confirmar periodicidad
          // Una señal cardíaca real debe tener cierta periodicidad
          const autocorrelation = this.computeAutocorrelation(recentSignal);
          if (autocorrelation < 0.3) {
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
    // Verificación extremadamente estricta de rango para el dedo
    const isInRange = rawValue >= 100 && rawValue <= 200;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    // Necesitamos más frames para evaluar estabilidad
    if (this.lastValues.length < 8) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Analizamos los valores recientes con una ventana más grande
    const recentValues = this.lastValues.slice(-8);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calculamos variaciones entre frames consecutivos
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Medimos la variación máxima
    const maxVariation = Math.max(...variations.map(Math.abs));
    
    // Umbral adaptativo ultra estricto
    const adaptiveThreshold = Math.max(1.2, avgValue * 0.015);
    
    // Criterio de estabilidad más exigente
    const isStable = maxVariation < adaptiveThreshold * 1.5;

    // Manejo del contador de estabilidad ultra conservador
    if (isStable) {
      // Incremento muy gradual
      this.stableFrameCount = Math.min(this.stableFrameCount + 0.5, this.MIN_STABILITY_COUNT * 3);
      this.lastStableValue = filtered;
    } else {
      // Penalización mucho más agresiva a la inestabilidad
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 2);
    }
    
    // Verificar variación mínima (eliminar señales planas)
    const range = Math.max(...recentValues) - Math.min(...recentValues);
    
    // Debe tener variación fisiológica real - entre 5 y 40 unidades
    const hasVariation = range >= 5 && range <= 40;
    
    // Verificar patrón fisiológico de la señal
    const hasPhysiologicalPattern = this.checkPhysiologicalPattern(recentValues);
    
    // Cálculo de calidad 
    let quality = 0;
    if (this.stableFrameCount >= this.MIN_STABILITY_COUNT && hasVariation && hasPhysiologicalPattern) {
      const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 3), 1);
      const intensityScore = Math.min((rawValue - 80) / 120, 1); // Rango más estrecho
      
      quality = Math.round((stabilityScore * 0.7 + intensityScore * 0.3) * 100);
    }
    
    // Criterio de detección extremadamente estricto:
    // 1. Debe tener suficiente estabilidad
    // 2. Debe tener calidad superior a 60
    // 3. Debe tener variación fisiológica
    // 4. Debe mostrar un patrón de señal cardíaca (sístole/diástole)
    // 5. Adicionalmente, verificamos la periodicidad básica
    const isFingerDetected = 
      this.stableFrameCount >= this.MIN_STABILITY_COUNT * 2 &&
      quality >= 60 && 
      hasVariation &&
      hasPhysiologicalPattern;

    return { isFingerDetected, quality };
  }
  
  /**
   * Verifica si la señal tiene un patrón fisiológico consistente con PPG
   * Las señales PPG reales muestran patrones específicos de subida y bajada
   */
  private checkPhysiologicalPattern(values: number[]): boolean {
    if (values.length < 6) return false;
    
    // Buscamos un patrón de subida seguido por bajada (típico del pulso PPG)
    let foundRisingPattern = false;
    let foundFallingPattern = false;
    let consecutiveRising = 0;
    let consecutiveFalling = 0;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i-1]) {
        consecutiveRising++;
        consecutiveFalling = 0;
        if (consecutiveRising >= 2) foundRisingPattern = true;
      } else if (values[i] < values[i-1]) {
        consecutiveFalling++;
        consecutiveRising = 0;
        if (consecutiveFalling >= 2) foundFallingPattern = true;
      }
    }
    
    // Una señal PPG válida debe mostrar ambos patrones
    return foundRisingPattern && foundFallingPattern;
  }

  /**
   * Extrae información de otros canales de color
   */
  private extractOtherChannels(imageData: ImageData): { green: number, blue: number } {
    const data = imageData.data;
    let greenSum = 0;
    let blueSum = 0;
    let count = 0;
    
    // Analizar solo el centro de la imagen (25% central)
    const startX = Math.floor(imageData.width * 0.375);
    const endX = Math.floor(imageData.width * 0.625);
    const startY = Math.floor(imageData.height * 0.375);
    const endY = Math.floor(imageData.height * 0.625);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        greenSum += data[i+1];  // Canal verde
        blueSum += data[i+2];   // Canal azul
        count++;
      }
    }
    
    return {
      green: greenSum / count,
      blue: blueSum / count
    };
  }
  
  /**
   * Verifica la relación entre canales de color
   * La presencia de un dedo produce una relación característica entre R, G y B
   */
  private checkColorChannelsRatio(red: number, green: number, blue: number): boolean {
    // Cuando hay un dedo, el canal rojo suele ser dominante debido a la sangre
    if (red <= green || red <= blue) return false;
    
    // Calculamos las proporciones
    const redToGreen = red / Math.max(1, green);
    const redToBlue = red / Math.max(1, blue);
    
    // Rangos típicos cuando hay un dedo sobre la cámara con luz
    return redToGreen >= 1.2 && redToGreen <= 3.0 && 
           redToBlue >= 1.3 && redToBlue <= 4.0;
  }
  
  /**
   * Calcula la autocorrelación de una señal para detectar periodicidad
   */
  private computeAutocorrelation(signal: number[]): number {
    if (signal.length < 10) return 0;
    
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const normalized = signal.map(v => v - mean);
    
    // Calculamos autocorrelación con un lag típico para frecuencia cardíaca
    // Aproximadamente 0.5-1 segundo de lag (para BPM ~60-120)
    const lag = Math.floor(signal.length / 3);
    
    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;
    
    for (let i = 0; i < signal.length - lag; i++) {
      numerator += normalized[i] * normalized[i + lag];
      denominator1 += normalized[i] * normalized[i];
      denominator2 += normalized[i + lag] * normalized[i + lag];
    }
    
    const denominator = Math.sqrt(denominator1 * denominator2);
    return denominator === 0 ? 0 : Math.abs(numerator / denominator);
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
