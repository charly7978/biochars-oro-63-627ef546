import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';
import { SignalOptimizerManager } from './signal-optimizer/SignalOptimizerManager';

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

// Constantes para canales de procesamiento
const CHANNEL_RED = 'red';
const CHANNEL_GREEN = 'green';
const CHANNEL_BLUE = 'blue';
const CHANNEL_IR = 'ir';

// Instancia global o de clase del optimizador para todos los canales relevantes
const optimizerManager = new SignalOptimizerManager({
  [CHANNEL_RED]: { filterType: 'bandpass', gain: 1.8, adaptiveMode: true },
  [CHANNEL_GREEN]: { filterType: 'ema', gain: 1.2, emaAlpha: 0.7 },
  [CHANNEL_BLUE]: { filterType: 'kalman', gain: 0.8, kalmanQ: 0.15, kalmanR: 0.1 },
  [CHANNEL_IR]: { filterType: 'wavelet', gain: 2.0, adaptiveMode: true }
});

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
    MIN_RED_THRESHOLD: 30, // Reducido para permitir mayor sensibilidad
    MAX_RED_THRESHOLD: 250, // Aumentado para mayor rango de detección
    STABILITY_WINDOW: 4,
    MIN_STABILITY_COUNT: 2 // Reducido para permitir detección más rápida
  };
  
  private currentConfig: typeof this.DEFAULT_CONFIG;
  
  // Parámetros de procesamiento
  private readonly BUFFER_SIZE = 15;
  private readonly MIN_RED_THRESHOLD = 30; // Valor más bajo
  private readonly MAX_RED_THRESHOLD = 250; // Valor más alto
  private readonly STABILITY_WINDOW = 4;
  private readonly MIN_STABILITY_COUNT = 2; // Reducido
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  
  // Nuevos parámetros para análisis mejorado
  private consistencyHistory: number[] = []; // Historial para evaluar consistencia
  private readonly CONSISTENCY_BUFFER_SIZE = 8; // Tamaño de ventana para consistencia
  private movementScores: number[] = []; // Puntuaciones de movimiento
  private readonly MOVEMENT_HISTORY_SIZE = 10; // Historial de movimiento
  private readonly MAX_MOVEMENT_THRESHOLD = 15; // Umbral máximo de movimiento permitido
  private readonly MIN_PERIODICITY_SCORE = 0.25; // Umbral mínimo de periodicidad
  
  // Procesamiento temporal
  private lastProcessedTime: number = 0;
  private readonly MIN_PROCESS_INTERVAL = 30; // Mínimo intervalo en ms entre procesamiento
  
  // Análisis de periodicidad
  private readonly PERIODICITY_BUFFER_SIZE = 60; // Ventana para análisis de periodicidad
  private periodicityBuffer: number[] = [];
  private lastPeriodicityScore: number = 0;
  
  // Evaluación adaptativa de región
  private lastROI = {
    startX: 0,
    startY: 0,
    endX: 0, 
    endY: 0,
    score: 0
  };
  private roiHistory: Array<{red: number, green: number, blue: number, score: number}> = [];

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
      this.consistencyHistory = [];
      this.movementScores = [];
      this.periodicityBuffer = [];
      this.lastPeriodicityScore = 0;
      this.roiHistory = [];
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
    this.consistencyHistory = [];
    this.movementScores = [];
    this.periodicityBuffer = [];
    this.roiHistory = [];
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
      await new Promise(resolve => setTimeout(resolve, 1500)); // Reducido para respuesta más rápida
      
      // Ajustar umbrales basados en las condiciones actuales - MÁS PERMISIVOS
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: Math.max(20, this.MIN_RED_THRESHOLD - 10), // Mucho más permisivo
        MAX_RED_THRESHOLD: Math.min(255, this.MAX_RED_THRESHOLD + 5),
        STABILITY_WINDOW: 3, // Menor ventana para permitir más variación
        MIN_STABILITY_COUNT: 2 // Requiere menos frames consecutivos
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
   * Procesa un frame para extraer información PPG de TODOS los canales
   * Cada canal pasa primero por el optimizador de señal
   * El feedback de calidad/confianza se enviará a cada canal tras el cálculo de métricas
   */
  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Control de frecuencia para evitar sobrecarga de procesamiento
      const now = Date.now();
      if (now - this.lastProcessedTime < this.MIN_PROCESS_INTERVAL) {
        return;
      }
      this.lastProcessedTime = now;
      
      // 1. Extraer valores crudos de todos los canales disponibles
      const { redValue, greenValue, blueValue, isValidRegion } = this.extractRGBChannels(imageData);
      
      // Si no se encontró una región válida, reducir calidad pero seguir procesando
      let qualityPenalty = isValidRegion ? 0 : 30;

      // 2. Optimización: procesar cada valor crudo con el manager
      const redOptimized = optimizerManager.process(CHANNEL_RED, redValue);
      const greenOptimized = optimizerManager.process(CHANNEL_GREEN, greenValue);
      const blueOptimized = optimizerManager.process(CHANNEL_BLUE, blueValue);

      // 3. Usar los valores optimizados en los algoritmos de cálculo
      // Ejemplo: para HR, SpO2, presión, etc. (esto se hará en los procesadores de métricas)
      // Aquí solo se almacena el valor principal (puedes almacenar todos si lo deseas)
      this.lastValues.push(redOptimized);
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }
      // Puedes almacenar buffers separados para cada canal si lo necesitas

      // Análisis de periodicidad
      this.periodicityBuffer.push(redOptimized);
      if (this.periodicityBuffer.length > this.PERIODICITY_BUFFER_SIZE) {
        this.periodicityBuffer.shift();
      }
      
      // Calcular consistencia en el tiempo
      this.updateConsistencyMetrics(redOptimized);
      
      // Calcular puntuación de movimiento (inestabilidad)
      const movementScore = this.calculateMovementScore();
      
      // Analizar la señal para determinar calidad y presencia del dedo (puedes hacerlo por canal)
      const { isFingerDetected, quality } = this.analyzeSignal(redOptimized, redValue, movementScore);
      
      // Calcular índice de perfusión
      const perfusionIndex = this.calculatePerfusionIndex();
      
      // Analizar periodicidad si tenemos suficientes datos
      if (this.periodicityBuffer.length > 30) {
        this.lastPeriodicityScore = this.analyzeSignalPeriodicity();
      }
      
      // Calcular datos espectrales reales usando FFT
      const spectrumData = this.calculateSpectrumData();

      // Crear señal procesada (puedes incluir los valores de todos los canales si lo deseas)
      const processedSignal: ProcessedSignal = {
        timestamp: now,
        rawValue: redValue,
        filteredValue: redOptimized,
        quality: Math.max(0, quality - qualityPenalty),
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue),
        perfusionIndex,
        spectrumData,
        // Nuevos campos para analíticas mejoradas
        minValue: Math.min(...this.lastValues),
        maxValue: Math.max(...this.lastValues),
        windowValues: [...this.lastValues]
      };

      // Enviar señal procesada
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error procesando frame de cámara");
    }
  }

  /**
   * Calcula datos espectrales reales usando FFT.
   * Este método realiza análisis de frecuencia real, NO simulación.
   */
  private calculateSpectrumData() {
    // Solo proceder si tenemos suficientes datos
    if (this.periodicityBuffer.length < 30) {
      return {
        frequencies: [],
        amplitudes: [],
        dominantFrequency: 0
      };
    }
    
    // Calcular media para normalización
    const mean = this.periodicityBuffer.reduce((sum, val) => sum + val, 0) / this.periodicityBuffer.length;
    
    // Normalizar datos para FFT
    const normalizedData = this.periodicityBuffer.map(val => val - mean);
    
    // Preparar arrays para resultados FFT
    const frequencies: number[] = [];
    const amplitudes: number[] = [];
    
    // Calcular FFT real (versión simplificada de DFT para dispositivos móviles)
    const N = normalizedData.length;
    const samplingRate = 1000 / this.MIN_PROCESS_INTERVAL; // Aproximadamente basado en tiempo entre frames
    
    // Calcular hasta la frecuencia de Nyquist (la mitad de la frecuencia de muestreo)
    // Solo incluimos el rango de frecuencias cardíacas humanas típicas (0.5-4Hz)
    const maxFreq = Math.min(4, samplingRate / 2);
    const minFreq = 0.5; // 30 BPM min
    
    // Resolución de frecuencia
    const freqStep = samplingRate / N;
    
    // Número máximo de frecuencias a analizar (reducido para rendimiento móvil)
    const maxBins = 25;
    
    let dominantFrequency = 0;
    let maxAmplitude = 0;
    
    // Implementación de DFT simplificada enfocada en rendimiento
    for (let k = 0; k < maxBins; k++) {
      const freq = k * freqStep;
      
      // Solo analizar frecuencias en el rango cardíaco
      if (freq < minFreq || freq > maxFreq) continue;
      
      let real = 0;
      let imag = 0;
      
      // Convertir frecuencia a BPM para tener significado fisiológico
      const freqInBPM = freq * 60;
      
      // Calcular componentes DFT
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += normalizedData[n] * Math.cos(angle);
        imag += normalizedData[n] * Math.sin(angle);
      }
      
      // Calcular magnitud
      const magnitude = Math.sqrt(real * real + imag * imag) / N;
      
      // Solo incluir si la magnitud es significativa
      if (magnitude > 0.1) {
        frequencies.push(freqInBPM);
        amplitudes.push(magnitude);
        
        // Encontrar frecuencia dominante
        if (magnitude > maxAmplitude) {
          maxAmplitude = magnitude;
          dominantFrequency = freqInBPM;
        }
      }
    }
    
    return {
      frequencies,
      amplitudes,
      dominantFrequency
    };
  }

  private updateConsistencyMetrics(value: number): void {
    this.consistencyHistory.push(value);
    if (this.consistencyHistory.length > this.CONSISTENCY_BUFFER_SIZE) {
      this.consistencyHistory.shift();
    }
  }
  
  private calculateMovementScore(): number {
    if (this.consistencyHistory.length < 3) {
      return this.MAX_MOVEMENT_THRESHOLD; // Valor máximo al inicio
    }
    
    // Calcular derivada primera (diferencias entre puntos consecutivos)
    const derivatives: number[] = [];
    for (let i = 1; i < this.consistencyHistory.length; i++) {
      derivatives.push(Math.abs(this.consistencyHistory[i] - this.consistencyHistory[i-1]));
    }
    
    // Calcular derivada segunda (cambios de pendiente)
    const secondDerivatives: number[] = [];
    for (let i = 1; i < derivatives.length; i++) {
      secondDerivatives.push(Math.abs(derivatives[i] - derivatives[i-1]));
    }
    
    // Determinar puntuación de movimiento basado en derivadas
    // Valor más alto = más movimiento = peor señal
    const avgFirstDerivative = derivatives.reduce((sum, val) => sum + val, 0) / derivatives.length;
    const avgSecondDerivative = secondDerivatives.length ? 
      secondDerivatives.reduce((sum, val) => sum + val, 0) / secondDerivatives.length : 0;
    
    // Mantener historial para suavizar cambios
    const movementScore = avgFirstDerivative * 0.7 + avgSecondDerivative * 0.3;
    this.movementScores.push(movementScore);
    if (this.movementScores.length > this.MOVEMENT_HISTORY_SIZE) {
      this.movementScores.shift();
    }
    
    // Devolver media ponderada dando más peso a las puntuaciones recientes
    const weightedSum = this.movementScores.reduce((sum, score, i, arr) => {
      const weight = (i + 1) / arr.length; // Mayor peso a valores más recientes
      return sum + score * weight;
    }, 0);
    
    const totalWeight = this.movementScores.reduce((sum, _, i, arr) => {
      return sum + (i + 1) / arr.length;
    }, 0);
    
    return weightedSum / totalWeight;
  }

  /**
   * Extrae canales RGB de la imagen con análisis de región óptima
   * OPTIMIZACIÓN: Análisis multiregional para identificar la mejor zona para PPG
   */
  private extractRGBChannels(imageData: ImageData): {
    redValue: number;
    greenValue: number;
    blueValue: number;
    isValidRegion: boolean;
  } {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Dividir la imagen en regiones para análisis
    const regions = [
      // Centro (40%)
      {
        startX: Math.floor(width * 0.3),
        startY: Math.floor(height * 0.3),
        endX: Math.floor(width * 0.7),
        endY: Math.floor(height * 0.7),
        weight: 1.0
      },
      // Cuarto superior izquierdo
      {
        startX: Math.floor(width * 0.1),
        startY: Math.floor(height * 0.1),
        endX: Math.floor(width * 0.4),
        endY: Math.floor(height * 0.4),
        weight: 0.7
      },
      // Cuarto superior derecho
      {
        startX: Math.floor(width * 0.6),
        startY: Math.floor(height * 0.1),
        endX: Math.floor(width * 0.9),
        endY: Math.floor(height * 0.4),
        weight: 0.7
      },
      // Cuarto inferior izquierdo
      {
        startX: Math.floor(width * 0.1),
        startY: Math.floor(height * 0.6),
        endX: Math.floor(width * 0.4),
        endY: Math.floor(height * 0.9),
        weight: 0.7
      },
      // Cuarto inferior derecho
      {
        startX: Math.floor(width * 0.6),
        startY: Math.floor(height * 0.6),
        endX: Math.floor(width * 0.9),
        endY: Math.floor(height * 0.9),
        weight: 0.7
      }
    ];
    
    // Analizar cada región
    const regionResults = regions.map(region => {
      let redSum = 0, greenSum = 0, blueSum = 0;
      let pixelCount = 0;
      
      // Muestreo adaptativo para mejorar rendimiento
      const sampleRate = Math.max(1, Math.floor(Math.min(width, height) / 120));
      
      for (let y = region.startY; y < region.endY; y += sampleRate) {
        for (let x = region.startX; x < region.endX; x += sampleRate) {
          const i = (y * width + x) * 4;
          redSum += data[i];
          greenSum += data[i + 1];
          blueSum += data[i + 2];
          pixelCount++;
        }
      }
      
      if (pixelCount === 0) return { red: 0, green: 0, blue: 0, score: 0, valid: false };
      
      const red = redSum / pixelCount;
      const green = greenSum / pixelCount;
      const blue = blueSum / pixelCount;
      
      // Criterios para evaluar la región
      const brightness = (red + green + blue) / 3;
      const redDominance = (red / (green + 0.1)) + (red / (blue + 0.1)); 
      const contrast = Math.max(red, green, blue) - Math.min(red, green, blue);
      
      // Score combinado
      let score = 0;
      
      // Factores que indican buena señal PPG
      if (red > 40 && red < 250) score += 2;  // Nivel rojo adecuado
      if (red > green * 1.2) score += 2;      // Dominancia de rojo
      if (red > blue * 1.2) score += 2;       // Dominancia de rojo
      if (brightness > 30 && brightness < 200) score += 1; // Brillo adecuado
      if (contrast > 15) score += 1;          // Contraste suficiente
      
      score *= region.weight;  // Ajustar por importancia de región
      
      return { red, green, blue, score, valid: score > 4 };
    });
    
    // Seleccionar mejor región
    const validRegions = regionResults.filter(r => r.valid);
    
    if (validRegions.length === 0) {
      // Si no hay regiones válidas, usar la central como fallback
      const centralRegion = regionResults[0];
      
      // Mantener la última ROI conocida para suavidad
      this.lastROI = {
        startX: regions[0].startX,
        startY: regions[0].startY, 
        endX: regions[0].endX,
        endY: regions[0].endY,
        score: centralRegion.score
      };
      
      return {
        redValue: centralRegion.red,
        greenValue: centralRegion.green,
        blueValue: centralRegion.blue,
        isValidRegion: false
      };
    }
    
    // Ordenar por score
    validRegions.sort((a, b) => b.score - a.score);
    const bestRegion = validRegions[0];
    
    // Encontrar a qué región pertenece el mejor resultado
    const bestRegionIndex = regionResults.findIndex(r => 
      r.red === bestRegion.red && r.green === bestRegion.green && r.blue === bestRegion.blue);
    
    // Actualizar ROI
    this.lastROI = {
      startX: regions[bestRegionIndex].startX,
      startY: regions[bestRegionIndex].startY,
      endX: regions[bestRegionIndex].endX,
      endY: regions[bestRegionIndex].endY,
      score: bestRegion.score
    };
    
    // Guardar historial para análisis de tendencias
    this.roiHistory.push({
      red: bestRegion.red,
      green: bestRegion.green,
      blue: bestRegion.blue,
      score: bestRegion.score
    });
    
    if (this.roiHistory.length > 5) {
      this.roiHistory.shift();
    }
    
    return {
      redValue: bestRegion.red,
      greenValue: bestRegion.green,
      blueValue: bestRegion.blue,
      isValidRegion: true
    };
  }

  /**
   * Calcula índice de perfusión
   */
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

  /**
   * Analiza la señal para determinar calidad y presencia de dedo
   * Incluye análisis de movimiento y periodicidad como factores
   */
  private analyzeSignal(
    filtered: number, 
    rawValue: number, 
    movementScore: number
  ): { isFingerDetected: boolean, quality: number } {
    // Verificación de umbrales básicos (más permisiva)
    const isInRange = rawValue >= this.MIN_RED_THRESHOLD && rawValue <= this.MAX_RED_THRESHOLD;
    
    // Si está completamente fuera de rango, no hay dedo
    if (!isInRange) {
      // Reducir contador de estabilidad gradualmente en lugar de reiniciar
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
      return { isFingerDetected: this.stableFrameCount > 0, quality: Math.max(0, this.stableFrameCount * 10) };
    }

    // Verificar si tenemos suficientes muestras para analizar
    if (this.lastValues.length < 3) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Analizar estabilidad de la señal (ahora más permisiva)
    const recentValues = this.lastValues.slice(-this.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Evaluar variaciones entre muestras consecutivas
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Detectar estabilidad con umbral adaptativo
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    // Umbral adaptativo basado en promedio (más permisivo)
    const adaptiveThreshold = Math.max(2.0, avgValue * 0.03);
    
    // Detección de estabilidad más permisiva
    const isStable = maxVariation < adaptiveThreshold * 3 && 
                    minVariation > -adaptiveThreshold * 3;
    
    // Ajustar contador de estabilidad
    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 0.5, this.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      // Reducción más gradual
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.2);
    }
    
    // Factor de movimiento (permite más movimiento)
    const movementFactor = Math.max(0, 1 - (movementScore / this.MAX_MOVEMENT_THRESHOLD));
    
    // Factor de periodicidad (buscar patrones cardíacos)
    const periodicityFactor = Math.max(0.3, this.lastPeriodicityScore);
    
    // Calcular calidad ponderando múltiples factores
    let quality = 0;
    
    // Siempre calcular calidad, incluso con estabilidad baja
    const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 1.5), 1);
    const intensityScore = Math.min((rawValue - this.MIN_RED_THRESHOLD) / 
                                  (this.MAX_RED_THRESHOLD - this.MIN_RED_THRESHOLD), 1);
    const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 4)));
    
    // Ponderación ajustada para ser más permisiva
    quality = Math.round((stabilityScore * 0.4 + 
                        intensityScore * 0.3 + 
                        variationScore * 0.1 + 
                        movementFactor * 0.1 + 
                        periodicityFactor * 0.1) * 100);
    
    // Detección de dedo más permisiva
    // Permitimos detección con calidad mínima más baja
    const minQualityThreshold = 30; // Umbral de calidad reducido
    const isFingerDetected = this.stableFrameCount >= this.MIN_STABILITY_COUNT * 0.7 && 
                            quality >= minQualityThreshold;

    return { isFingerDetected, quality };
  }

  /**
   * Analiza la periodicidad de la señal para determinar calidad
   * Busca patrones rítmicos consistentes con pulso cardíaco
   */
  private analyzeSignalPeriodicity(): number {
    if (this.periodicityBuffer.length < 30) {
      return 0.3; // Valor base para evitar penalizar demasiado al inicio
    }
    
    const signal = this.periodicityBuffer.slice(-30);
    const signalMean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    
    const normalizedSignal = signal.map(val => val - signalMean);
    
    // Más permisivos con el rango de rezagos
    const maxLag = 25;
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
    
    let maxCorrelation = 0.3; // Valor base mínimo
    let periodFound = false;
    
    // Permitir un rango más amplio de frecuencias (incluye ritmos cardíacos más extremos)
    for (let i = 1; i < correlations.length - 1; i++) {
      if (correlations[i] > correlations[i-1] && 
          correlations[i] > correlations[i+1] && 
          correlations[i] > 0.15) { // Umbral más permisivo
        
        // Rango ampliado para permitir más variabilidad
        if (i >= 3 && i <= 20) {
          if (correlations[i] > maxCorrelation) {
            maxCorrelation = correlations[i];
            periodFound = true;
          }
        }
      }
    }
    
    // Siempre devolver un valor mínimo razonable
    return Math.max(0.3, Math.min(1.0, maxCorrelation));
  }

  /**
   * Detecta región de interés (ROI) para análisis
   */
  private detectROI(redValue: number): ProcessedSignal['roi'] {
    return {
      x: this.lastROI.startX,
      y: this.lastROI.startY,
      width: this.lastROI.endX - this.lastROI.startX,
      height: this.lastROI.endY - this.lastROI.startY
    };
  }

  /**
   * Gestiona errores del procesador
   */
  private handleError(code: string, message: string): void {
    if (this.onError) {
      this.onError({
        code,
        message,
        timestamp: Date.now()
      });
    }
  }
}
