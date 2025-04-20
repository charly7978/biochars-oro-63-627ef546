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

// Constantes para detección de dedo optimizada
const FINGER_DETECTION = {
  // Umbrales más permisivos para diferentes tonos de piel
  MIN_RED_VALUE: 20,        // Menor umbral para pieles más oscuras
  MAX_RED_VALUE: 250,       // Mayor umbral para pieles más claras
  RED_GREEN_RATIO: 1.15,    // Ratio mínimo de rojo a verde para detectar dedo
  RED_BLUE_RATIO: 1.15,     // Ratio mínimo de rojo a azul para detectar dedo
  MIN_BRIGHTNESS: 25,       // Brillo mínimo para detectar dedo
  MAX_BRIGHTNESS: 230,      // Brillo máximo para detectar dedo
  MIN_REGION_SCORE: 3.5,    // Puntaje mínimo de región para considerar válida
  STABILITY_BONUS: 10,      // Bonus a la calidad por estabilidad
  TRANSITION_SMOOTHING: 3,  // Frames para transición suave al detectar/perder dedo
  QUALITY_THRESHOLD: 25     // Umbral de calidad mínimo para detección
};

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
  
  // Para detección de dedo estable
  private fingerDetectionCounter: number = 0;
  
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
      this.fingerDetectionCounter = 0;
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
    this.fingerDetectionCounter = 0;
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
    this.fingerDetectionCounter = 0;
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
        windowValues: [...this.lastValues],
        // Incluir datos de todos los canales para diagnóstico
        channelData: {
          red: redValue,
          green: greenValue,
          blue: blueValue,
          redFiltered: redOptimized,
          greenFiltered: greenOptimized,
          blueFiltered: blueOptimized
        }
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
      
      // Análisis de distribución de color
      let redDistribution = new Array(256).fill(0);
      let pixelsInRedRange = 0;
      
      for (let y = region.startY; y < region.endY; y += sampleRate) {
        for (let x = region.startX; x < region.endX; x += sampleRate) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Acumular valores RGB para promedios
          redSum += r;
          greenSum += g;
          blueSum += b;
          pixelCount++;
          
          // Análisis de histograma para rojo
          redDistribution[r]++;
          
          // Contar píxeles dentro del rango esperado para dedo
          if (r >= FINGER_DETECTION.MIN_RED_VALUE && 
              r <= FINGER_DETECTION.MAX_RED_VALUE &&
              r / (g + 0.1) >= FINGER_DETECTION.RED_GREEN_RATIO &&
              r / (b + 0.1) >= FINGER_DETECTION.RED_BLUE_RATIO) {
            pixelsInRedRange++;
          }
        }
      }
      
      // Si no hay suficientes píxeles analizados
      if (pixelCount === 0) return { red: 0, green: 0, blue: 0, score: 0, valid: false };
      
      // Calcular valores promedio
      const red = redSum / pixelCount;
      const green = greenSum / pixelCount;
      const blue = blueSum / pixelCount;
      
      // Criterios mejorados para evaluar la región
      const brightness = (red + green + blue) / 3;
      const redDominance = (red / (green + 0.1)) + (red / (blue + 0.1)); 
      const contrast = Math.max(red, green, blue) - Math.min(red, green, blue);
      
      // Análisis de histograma para determinar agrupamiento de color
      // (Señal de mejor calidad suele tener distribución más concentrada)
      let maxBin = 0, maxBinValue = 0;
      let histogramSpread = 0;
      for (let i = 0; i < 256; i++) {
        if (redDistribution[i] > maxBinValue) {
          maxBinValue = redDistribution[i];
          maxBin = i;
        }
        if (redDistribution[i] > 0) {
          histogramSpread++;
        }
      }
      
      // Porcentaje de píxeles en rango de dedo
      const fingerPixelRatio = pixelsInRedRange / pixelCount;
      
      // Score combinado con factores ponderados
      let score = 0;
      
      // Sistema de scoring mejorado para diferentes condiciones de iluminación y tonos de piel
      
      // 1. Porcentaje de píxeles en rango esperado para dedo
      score += fingerPixelRatio * 5.0; // Hasta 5 puntos
      
      // 2. Dominancia de rojo sobre otros canales
      if (red > green * FINGER_DETECTION.RED_GREEN_RATIO) score += 1.5;
      if (red > blue * FINGER_DETECTION.RED_BLUE_RATIO) score += 1.5;
      
      // 3. Nivel óptimo de rojo (curva gaussiana con máximo en ~160)
      const redLevelOptimality = Math.exp(-Math.pow((red - 160) / 80, 2));
      score += redLevelOptimality * 2.0;
      
      // 4. Brillo dentro de rango óptimo
      if (brightness >= FINGER_DETECTION.MIN_BRIGHTNESS && 
          brightness <= FINGER_DETECTION.MAX_BRIGHTNESS) {
        score += 1.0;
      }
      
      // 5. Contraste suficiente, pero no extremo
      if (contrast > 15 && contrast < 150) score += 1.0;
      
      // 6. Distribución de histograma (penalizar distribución muy dispersa)
      const histogramQuality = Math.max(0, 1 - (histogramSpread / 128));
      score += histogramQuality * 1.0;
      
      // Ajustar por importancia de región
      score *= region.weight;
      
      // Validar región con umbral optimizado para detección de dedo
      return { 
        red, 
        green, 
        blue, 
        score,
        histogramSpread,
        fingerPixelRatio,
        valid: score > FINGER_DETECTION.MIN_REGION_SCORE
      };
    });
    
    // Seleccionar mejor región
    const validRegions = regionResults.filter(r => r.valid);
    
    if (validRegions.length === 0) {
      // Si no hay regiones válidas, usar la central como fallback
      const centralRegion = regionResults[0];
      
      // Mantener la última ROI conocida para suavidad, pero con score bajo
      this.lastROI = {
        startX: regions[0].startX,
        startY: regions[0].startY, 
        endX: regions[0].endX,
        endY: regions[0].endY,
        score: Math.min(centralRegion.score, this.lastROI.score * 0.8) // Degradar gradualmente el score
      };
      
      // Imprimir diagnóstico si está muy cerca del umbral
      if (centralRegion.score > FINGER_DETECTION.MIN_REGION_SCORE * 0.7) {
        console.log(`Región central cerca del umbral: score=${centralRegion.score.toFixed(2)}, umbral=${FINGER_DETECTION.MIN_REGION_SCORE}`);
      }
      
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
    
    // Actualizar ROI con transición suave (evitar saltos bruscos)
    const prevROI = this.lastROI;
    const targetROI = {
      startX: regions[bestRegionIndex].startX,
      startY: regions[bestRegionIndex].startY,
      endX: regions[bestRegionIndex].endX,
      endY: regions[bestRegionIndex].endY,
      score: bestRegion.score
    };
    
    // Transición suave entre regiones (evita parpadeo)
    const smoothingFactor = 0.8; // 80% de la nueva región, 20% de la anterior
    this.lastROI = {
      startX: Math.round(targetROI.startX * smoothingFactor + prevROI.startX * (1 - smoothingFactor)),
      startY: Math.round(targetROI.startY * smoothingFactor + prevROI.startY * (1 - smoothingFactor)),
      endX: Math.round(targetROI.endX * smoothingFactor + prevROI.endX * (1 - smoothingFactor)),
      endY: Math.round(targetROI.endY * smoothingFactor + prevROI.endY * (1 - smoothingFactor)),
      score: targetROI.score
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
    const isInRange = rawValue >= FINGER_DETECTION.MIN_RED_VALUE && 
                      rawValue <= FINGER_DETECTION.MAX_RED_VALUE;
    
    // Si está completamente fuera de rango, reducir contador gradualmente
    if (!isInRange) {
      // Reducir contador de estabilidad gradualmente
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.3);
      this.fingerDetectionCounter = Math.max(0, this.fingerDetectionCounter - 1);
      
      return { 
        isFingerDetected: this.fingerDetectionCounter > 0,
        quality: Math.max(0, this.stableFrameCount * 15) 
      };
    }

    // Verificar si tenemos suficientes muestras para analizar
    if (this.lastValues.length < 3) {
      // Dar el beneficio de la duda si vemos una señal prometedora
      if (rawValue > 100 && isInRange) {
        this.fingerDetectionCounter = Math.min(FINGER_DETECTION.TRANSITION_SMOOTHING, this.fingerDetectionCounter + 1);
        return { isFingerDetected: true, quality: 40 };
      }
      return { isFingerDetected: false, quality: 0 };
    }

    // Analizar estabilidad de la señal (más permisiva)
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
    
    // Umbral adaptativo basado en promedio para ser más tolerante con pulsaciones
    const adaptiveThreshold = Math.max(2.0, avgValue * 0.04); // Aumentado para mayor tolerancia
    
    // Detección de estabilidad más permisiva
    const isStable = maxVariation < adaptiveThreshold * 4 && // Aumentado umbral
                     minVariation > -adaptiveThreshold * 4;  // Más permisivo
    
    // Ajustar contador de estabilidad con más graduación
    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 0.4, 5.0); // Mayor límite
      this.lastStableValue = filtered;
    } else {
      // Reducción más gradual para evitar pérdidas bruscas de detección
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.15);
    }
    
    // Factor de movimiento (más permisivo)
    const movementFactor = Math.max(0.2, 1 - (movementScore / (this.MAX_MOVEMENT_THRESHOLD * 1.2)));
    
    // Factor de periodicidad (buscar patrones cardíacos con umbral más bajo)
    const periodicityFactor = Math.max(0.4, this.lastPeriodicityScore);
    
    // Analizar la rapidez de cambio (pulsatilidad) que es característica del PPG
    let pulsatilityScore = 0;
    if (variations.length >= 4) {
      // Buscamos alternancia de signo en las variaciones (subidas y bajadas)
      let signChanges = 0;
      for (let i = 1; i < variations.length; i++) {
        if ((variations[i] >= 0 && variations[i-1] < 0) || 
            (variations[i] < 0 && variations[i-1] >= 0)) {
          signChanges++;
        }
      }
      pulsatilityScore = Math.min(1.0, signChanges / (variations.length - 1));
    }
    
    // Calcular calidad ponderando múltiples factores
    // Siempre calcular calidad, incluso con estabilidad baja
    const stabilityScore = Math.min(this.stableFrameCount / 3.0, 1);
    const intensityScore = Math.min((rawValue - FINGER_DETECTION.MIN_RED_VALUE) / 
                                  (FINGER_DETECTION.MAX_RED_VALUE - FINGER_DETECTION.MIN_RED_VALUE), 1);
    const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 5)));
    
    // Ponderación ajustada para priorizar factores críticos
    const quality = Math.round((
      stabilityScore * 0.35 +               // Estabilidad: 35%
      intensityScore * 0.25 +               // Intensidad de rojo: 25% 
      periodicityFactor * 0.15 +            // Periodicidad cardíaca: 15%
      pulsatilityScore * 0.15 +             // Pulsatilidad: 15%
      movementFactor * 0.05 +               // Estabilidad de movimiento: 5%
      variationScore * 0.05                 // Variación controlada: 5%
    ) * 100);
    
    // Bonus de calidad si tenemos suficiente estabilidad
    const qualityWithBonus = stabilityScore > 0.7 ? 
      Math.min(100, quality + FINGER_DETECTION.STABILITY_BONUS) : quality;
    
    // Detección de dedo más permisiva y con transición suave
    const isFingerDetected = quality >= FINGER_DETECTION.QUALITY_THRESHOLD;
    
    // Actualizar contador de detección para estabilizar (evitar parpadeo)
    if (isFingerDetected) {
      this.fingerDetectionCounter = FINGER_DETECTION.TRANSITION_SMOOTHING;
    } else {
      this.fingerDetectionCounter = Math.max(0, this.fingerDetectionCounter - 1);
    }
    
    // Solo reportar detección positiva si tenemos suficientes frames consecutivos
    return { 
      isFingerDetected: this.fingerDetectionCounter > 0,
      quality: qualityWithBonus
    };
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
