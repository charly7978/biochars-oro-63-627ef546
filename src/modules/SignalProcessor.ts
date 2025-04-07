
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
  
  // Nuevas variables para ROI dinámico
  private dynamicROI = {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    lastUpdateTime: 0
  };
  private roiUpdateInterval = 500; // ms entre actualizaciones de ROI
  
  // Variables para detección multicanal
  private channelWeights = {
    red: 0.6,
    green: 0.3,
    blue: 0.1
  };
  private channelSignals = {
    red: [] as number[],
    green: [] as number[],
    blue: [] as number[]
  };
  
  // Variables para estabilización de exposición
  private exposureHistory: number[] = [];
  private readonly EXPOSURE_HISTORY_SIZE = 10;
  private exposureNormalizationFactor = 1.0;

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
      
      // Inicializar variables para capacidades mejoradas
      this.channelSignals = {
        red: [],
        green: [],
        blue: []
      };
      this.exposureHistory = [];
      this.exposureNormalizationFactor = 1.0;
      this.dynamicROI = {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        lastUpdateTime: 0
      };
      
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
      
      // Calcular pesos óptimos de canales basados en datos iniciales
      this.calculateOptimalChannelWeights();

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
      // Control de frecuencia para evitar sobrecarga de procesamiento
      const now = Date.now();
      if (now - this.lastProcessedTime < this.MIN_PROCESS_INTERVAL) {
        return;
      }
      this.lastProcessedTime = now;
      
      // Extraer valores de todos los canales y actualizar ROI dinámico
      const channelValues = this.extractMultiChannelValues(imageData);
      
      // Actualizar historial de exposición para normalización
      this.updateExposureHistory(channelValues.red);
      
      // Calcular valor combinado multicanal
      const combinedValue = this.calculateMultiChannelValue(channelValues);
      
      // Aplicar filtrado inicial para reducir ruido
      const filtered = this.kalmanFilter.filter(combinedValue);
      
      // Almacenar para análisis
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }
      
      // Análisis de periodicidad
      this.periodicityBuffer.push(filtered);
      if (this.periodicityBuffer.length > this.PERIODICITY_BUFFER_SIZE) {
        this.periodicityBuffer.shift();
      }
      
      // Calcular consistencia en el tiempo
      this.updateConsistencyMetrics(filtered);
      
      // Calcular puntuación de movimiento (inestabilidad)
      const movementScore = this.calculateMovementScore();
      
      // Analizar la señal para determinar calidad y presencia del dedo
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, channelValues.red, movementScore);
      
      // Calcular índice de perfusión
      const perfusionIndex = this.calculatePerfusionIndex();
      
      // Analizar periodicidad si tenemos suficientes datos
      if (this.periodicityBuffer.length > 30) {
        this.lastPeriodicityScore = this.analyzeSignalPeriodicity();
      }
      
      // Calcular datos espectrales
      const spectrumData = this.calculateSpectrumData();

      // Crear señal procesada
      const processedSignal: ProcessedSignal = {
        timestamp: now,
        rawValue: channelValues.red,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.dynamicROI,
        perfusionIndex,
        spectrumData
      };

      // Enviar señal procesada
      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }
  
  /**
   * Extrae valores de todos los canales y actualiza ROI dinámico
   */
  private extractMultiChannelValues(imageData: ImageData): { red: number, green: number, blue: number } {
    // Actualizar ROI dinámicamente cada cierto intervalo
    const now = Date.now();
    if (now - this.dynamicROI.lastUpdateTime >= this.roiUpdateInterval) {
      this.updateDynamicROI(imageData);
    }
    
    const data = imageData.data;
    let redSum = 0, greenSum = 0, blueSum = 0;
    let count = 0;
    
    // Usar ROI dinámico para extracción
    const roi = this.dynamicROI;
    
    // Asegurar que el ROI está dentro de los límites de la imagen
    const startX = Math.max(0, Math.min(roi.x, imageData.width - 1));
    const endX = Math.max(0, Math.min(roi.x + roi.width, imageData.width));
    const startY = Math.max(0, Math.min(roi.y, imageData.height - 1));
    const endY = Math.max(0, Math.min(roi.y + roi.height, imageData.height));
    
    // Muestreo eficiente (no todos los píxeles)
    const sampleStep = imageData.width > 640 ? 2 : 1;
    
    for (let y = startY; y < endY; y += sampleStep) {
      for (let x = startX; x < endX; x += sampleStep) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];       // Canal rojo
        greenSum += data[i + 1]; // Canal verde
        blueSum += data[i + 2];  // Canal azul
        count++;
      }
    }
    
    if (count === 0) {
      // Fallback al centro si el ROI está fuera de la imagen
      const defaultX = Math.floor(imageData.width * 0.3);
      const defaultY = Math.floor(imageData.height * 0.3);
      const defaultWidth = Math.floor(imageData.width * 0.4);
      const defaultHeight = Math.floor(imageData.height * 0.4);
      
      for (let y = defaultY; y < defaultY + defaultHeight; y += sampleStep) {
        for (let x = defaultX; x < defaultX + defaultWidth; x += sampleStep) {
          const i = (y * imageData.width + x) * 4;
          redSum += data[i];
          greenSum += data[i + 1];
          blueSum += data[i + 2];
          count++;
        }
      }
    }
    
    // Normalizar y aplicar factor de exposición
    const redAvg = (redSum / count) * this.exposureNormalizationFactor;
    const greenAvg = (greenSum / count) * this.exposureNormalizationFactor;
    const blueAvg = (blueSum / count) * this.exposureNormalizationFactor;
    
    // Almacenar valores para análisis de SNR
    this.channelSignals.red.push(redAvg);
    this.channelSignals.green.push(greenAvg);
    this.channelSignals.blue.push(blueAvg);
    
    if (this.channelSignals.red.length > 30) {
      this.channelSignals.red.shift();
      this.channelSignals.green.shift();
      this.channelSignals.blue.shift();
    }
    
    // Optimizar pesos de canales periódicamente
    if (this.channelSignals.red.length >= 15 && now % 5000 < 100) {
      this.calculateOptimalChannelWeights();
    }
    
    return { red: redAvg, green: greenAvg, blue: blueAvg };
  }
  
  /**
   * Actualiza el ROI dinámicamente para seguir la mejor señal
   */
  private updateDynamicROI(imageData: ImageData): void {
    const data = imageData.data;
    const gridSize = 4;
    const cellWidth = Math.floor(imageData.width / gridSize);
    const cellHeight = Math.floor(imageData.height / gridSize);
    
    let maxSignalStrength = -1;
    let bestCell = { x: 0, y: 0 };
    
    const sampleStep = imageData.width > 640 ? 3 : 2;
    
    for (let gridY = 0; gridY < gridSize; gridY++) {
      for (let gridX = 0; gridX < gridSize; gridX++) {
        let redSum = 0;
        let greenSum = 0;
        let count = 0;
        
        const startX = gridX * cellWidth;
        const endX = Math.min((gridX + 1) * cellWidth, imageData.width);
        const startY = gridY * cellHeight;
        const endY = Math.min((gridY + 1) * cellHeight, imageData.height);
        
        // Muestreo para eficiencia
        for (let y = startY; y < endY; y += sampleStep) {
          for (let x = startX; x < endX; x += sampleStep) {
            const i = (y * imageData.width + x) * 4;
            redSum += data[i];       
            greenSum += data[i + 1]; 
            count++;
          }
        }
        
        if (count > 0) {
          const redAvg = redSum / count;
          const greenAvg = greenSum / count;
          const redGreenRatio = greenAvg > 0 ? redAvg / greenAvg : 0;
          
          // Señal para detección de piel humana (alto rojo, proporción rojo/verde específica)
          const signalStrength = redAvg * Math.pow(redGreenRatio, 0.8);
          
          if (signalStrength > maxSignalStrength) {
            maxSignalStrength = signalStrength;
            bestCell = { x: gridX, y: gridY };
          }
        }
      }
    }
    
    // Actualizar ROI con la mejor celda encontrada
    const now = Date.now();
    
    // Suavizar cambios en el ROI
    if (this.dynamicROI.width > 0) {
      this.dynamicROI = {
        x: Math.floor(this.dynamicROI.x * 0.7 + bestCell.x * cellWidth * 0.3),
        y: Math.floor(this.dynamicROI.y * 0.7 + bestCell.y * cellHeight * 0.3),
        width: Math.floor(this.dynamicROI.width * 0.8 + cellWidth * 0.2),
        height: Math.floor(this.dynamicROI.height * 0.8 + cellHeight * 0.2),
        lastUpdateTime: now
      };
    } else {
      // Primera actualización
      this.dynamicROI = {
        x: bestCell.x * cellWidth,
        y: bestCell.y * cellHeight,
        width: cellWidth,
        height: cellHeight,
        lastUpdateTime: now
      };
    }
  }
  
  /**
   * Calcula valor combinado multicanal con pesos optimizados
   */
  private calculateMultiChannelValue(channelValues: { red: number, green: number, blue: number }): number {
    return (
      channelValues.red * this.channelWeights.red +
      channelValues.green * this.channelWeights.green +
      channelValues.blue * this.channelWeights.blue
    );
  }
  
  /**
   * Optimiza pesos de canales basados en SNR
   */
  private calculateOptimalChannelWeights(): void {
    if (this.channelSignals.red.length < 10) {
      return; // No hay suficientes datos
    }
    
    // Calcular SNR para cada canal
    const redSNR = this.calculateSNR(this.channelSignals.red);
    const greenSNR = this.calculateSNR(this.channelSignals.green);
    const blueSNR = this.calculateSNR(this.channelSignals.blue);
    
    const totalSNR = redSNR + greenSNR + blueSNR;
    
    if (totalSNR > 0) {
      // Asegurar mínimo para el canal rojo
      const minRedWeight = 0.3; 
      let redWeight = Math.max(minRedWeight, redSNR / totalSNR);
      
      // Distribuir el resto entre verde y azul según SNR
      const remainingWeight = 1.0 - redWeight;
      const greenBlueTotal = greenSNR + blueSNR;
      
      let greenWeight, blueWeight;
      
      if (greenBlueTotal > 0) {
        greenWeight = remainingWeight * (greenSNR / greenBlueTotal);
        blueWeight = remainingWeight * (blueSNR / greenBlueTotal);
      } else {
        greenWeight = remainingWeight * 0.7;
        blueWeight = remainingWeight * 0.3;
      }
      
      this.channelWeights = {
        red: redWeight,
        green: greenWeight,
        blue: blueWeight
      };
    }
  }
  
  /**
   * Calcula SNR (Relación Señal-Ruido)
   */
  private calculateSNR(signal: number[]): number {
    if (signal.length < 5) return 0;
    
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const signalPower = Math.pow(mean, 2);
    
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    
    return variance > 0 ? signalPower / variance : 0;
  }
  
  /**
   * Actualiza el factor de normalización de exposición
   */
  private updateExposureHistory(redValue: number): void {
    this.exposureHistory.push(redValue);
    if (this.exposureHistory.length > this.EXPOSURE_HISTORY_SIZE) {
      this.exposureHistory.shift();
    }
    
    if (this.exposureHistory.length >= this.EXPOSURE_HISTORY_SIZE / 2) {
      const mean = this.exposureHistory.reduce((sum, val) => sum + val, 0) / this.exposureHistory.length;
      
      // Rango óptimo para valores de 8-bit
      const targetValue = 128;
      
      if (mean > 0) {
        const newFactor = targetValue / mean;
        // Cambio gradual para evitar oscilaciones
        this.exposureNormalizationFactor = this.exposureNormalizationFactor * 0.8 + newFactor * 0.2;
      }
    }
  }
  
  /**
   * Actualiza métricas de consistencia
   */
  private updateConsistencyMetrics(value: number): void {
    this.consistencyHistory.push(value);
    if (this.consistencyHistory.length > this.CONSISTENCY_BUFFER_SIZE) {
      this.consistencyHistory.shift();
    }
  }
  
  /**
   * Calcula puntuación de movimiento (0-100, donde 0 es muy estable)
   */
  private calculateMovementScore(): number {
    if (this.consistencyHistory.length < 4) {
      return 100; // Máximo movimiento si no hay suficientes datos
    }
    
    // Calcular variaciones entre muestras consecutivas
    const variations: number[] = [];
    for (let i = 1; i < this.consistencyHistory.length; i++) {
      variations.push(Math.abs(this.consistencyHistory[i] - this.consistencyHistory[i-1]));
    }
    
    // Calcular desviación estándar
    const mean = variations.reduce((a, b) => a + b, 0) / variations.length;
    const variance = variations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / variations.length;
    const stdDev = Math.sqrt(variance);
    
    // Calcular puntuación (normalizada a 0-100)
    const score = Math.min(100, stdDev * 10);
    
    // Mantener historial para suavizado
    this.movementScores.push(score);
    if (this.movementScores.length > this.MOVEMENT_HISTORY_SIZE) {
      this.movementScores.shift();
    }
    
    // Retornar promedio ponderado (más peso a valores recientes)
    let weightedSum = 0;
    let weightSum = 0;
    this.movementScores.forEach((s, i) => {
      const weight = i + 1;
      weightedSum += s * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : 100;
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
   * Calcula datos de espectro de frecuencia
   */
  private calculateSpectrumData() {
    if (this.periodicityBuffer.length < 30) {
      return undefined;
    }
    
    // Implementación básica, podría ser mejorada con FFT real
    const buffer = this.periodicityBuffer.slice(-30);
    const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    const normalizedBuffer = buffer.map(v => v - mean);
    
    // Simular análisis espectral simple
    const frequencies: number[] = [];
    const amplitudes: number[] = [];
    
    // Calcular amplitudes para diferentes frecuencias
    for (let freq = 0.5; freq <= 4.0; freq += 0.1) {
      frequencies.push(freq);
      
      let amplitude = 0;
      for (let i = 0; i < normalizedBuffer.length; i++) {
        const phase = (i / normalizedBuffer.length) * Math.PI * 2 * freq;
        amplitude += normalizedBuffer[i] * Math.sin(phase);
      }
      amplitude = Math.abs(amplitude) / normalizedBuffer.length;
      amplitudes.push(amplitude);
    }
    
    // Encontrar la frecuencia dominante
    let maxIndex = 0;
    for (let i = 1; i < amplitudes.length; i++) {
      if (amplitudes[i] > amplitudes[maxIndex]) {
        maxIndex = i;
      }
    }
    
    return {
      frequencies,
      amplitudes,
      dominantFrequency: frequencies[maxIndex]
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
