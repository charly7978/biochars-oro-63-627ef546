import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

/**
 * IMPORTANTE: APLICACIÓN DE REFERENCIA MÉDICA
 * Esta aplicación es solo con fines de referencia y no reemplaza dispositivos médicos certificados.
 * Todo el procesamiento es real, sin simulaciones, manipulaciones o forzamientos excesivos.
 */

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
 * 
 * AVISO MÉDICO: Este procesador trabaja con datos reales de la cámara.
 * No simula resultados ni utiliza valores prefabricados.
 */
export class PPGSignalProcessor implements SignalProcessor {
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private lastValues: number[] = [];
  
  // Configuración por defecto - Valores mucho más estrictos
  private readonly DEFAULT_CONFIG = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 80,      // Más alto para exigir más intensidad
    MAX_RED_THRESHOLD: 230,
    STABILITY_WINDOW: 6,        // Ventana más grande para exigir más estabilidad
    MIN_STABILITY_COUNT: 4      // Más frames estables requeridos
  };
  
  private currentConfig: typeof this.DEFAULT_CONFIG;
  
  // Parámetros de procesamiento - Valores más estrictos
  private readonly BUFFER_SIZE = 15;
  private readonly MIN_RED_THRESHOLD = 80;
  private readonly MAX_RED_THRESHOLD = 230;
  private readonly STABILITY_WINDOW = 6;
  private readonly MIN_STABILITY_COUNT = 4;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  
  // Parámetros de análisis de calidad - Más exigentes
  private readonly PERFUSION_INDEX_THRESHOLD = 0.07;
  private readonly SIGNAL_QUALITY_THRESHOLD = 65;
  
  // Análisis de periodicidad
  private baselineValue: number = 0;
  private readonly WAVELET_THRESHOLD = 0.03;  // Menos tolerante al ruido
  private readonly BASELINE_FACTOR = 0.92;
  private periodicityBuffer: number[] = [];
  private readonly PERIODICITY_BUFFER_SIZE = 40;
  
  // Valor MUY exigente para periodicidad para evitar falsos positivos
  private readonly MIN_PERIODICITY_SCORE = 0.55;  // Mucho más alto
  
  // Variables para validación física de la señal
  private lastFramesVariation: number[] = []; 
  private readonly FRAMES_VARIATION_SIZE = 15;    // Más frames para mejor análisis
  private readonly MIN_VALID_VARIATION = 0.25;    // Variación mínima más alta
  private readonly MAX_STATIC_RATIO = 0.4;
  
  // Variables para análisis de patrones de pulsación
  private pulsationPatternBuffer: number[] = [];
  private readonly PULSATION_BUFFER_SIZE = 30;
  private readonly PULSATION_FREQUENCY_MIN = 0.8;  // ~48 BPM
  private readonly PULSATION_FREQUENCY_MAX = 2.5;  // ~150 BPM
  
  // Historial de intensidad de valores para fingerprint detection
  private intensityHistory: number[] = [];
  private readonly INTENSITY_HISTORY_SIZE = 20;
  private readonly MIN_INTENSITY_VARIATION = 6.0;   // Más alta
  
  // Nuevo: historial de valores de detección para reducir falsos positivos
  private detectionHistory: boolean[] = [];
  private readonly DETECTION_HISTORY_SIZE = 10;
  private readonly MIN_DETECTION_RATIO = 0.7;      // Más exigente
  
  // Nuevo: contador para prevenir detecciones inmediatas
  private frameCounter: number = 0;
  private readonly MIN_FRAMES_BEFORE_DETECTION = 10;
  
  // Nuevo: memoria de valores de base para comparación
  private baselineHistory: number[] = [];
  private readonly BASELINE_HISTORY_SIZE = 20;
  private hasEstablishedBaseline: boolean = false;
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    console.log("PPGSignalProcessor: Instancia creada - Configuración de alta exigencia");
  }

  /**
   * Inicializa el procesador
   * AVISO: No utiliza valores simulados, solo inicialización de variables
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
      this.detectionHistory = [];
      this.frameCounter = 0;
      this.baselineHistory = [];
      this.hasEstablishedBaseline = false;
      console.log("PPGSignalProcessor: Inicializado con parámetros estrictos");
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
    this.detectionHistory = [];
    this.frameCounter = 0;
    this.baselineHistory = [];
    this.hasEstablishedBaseline = false;
    console.log("PPGSignalProcessor: Detenido");
  }

  /**
   * Restablece el procesador a su estado inicial
   * Necesario para implementar la interfaz SignalProcessor
   */
  reset(): void {
    this.stop();
    this.lastValues = [];
    this.stableFrameCount = 0;
    this.lastStableValue = 0;
    this.kalmanFilter.reset();
    this.baselineValue = 0;
    this.periodicityBuffer = [];
    this.lastFramesVariation = [];
    this.pulsationPatternBuffer = [];
    this.intensityHistory = [];
    this.detectionHistory = [];
    this.frameCounter = 0;
    this.baselineHistory = [];
    this.hasEstablishedBaseline = false;
    console.log("PPGSignalProcessor: Reset aplicado, procesador en estado inicial");
  }

  /**
   * Calibra el procesador para mejores resultados
   * IMPORTANTE: Esta es una calibración REAL, captura datos del ambiente para establecer líneas base.
   * NO utiliza simulaciones, delays artificiales o valores prefabricados.
   */
  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración real del entorno");
      await this.initialize();
      
      // Establecer que aún no tenemos línea base establecida
      // La línea base se recolectará en los primeros frames de video
      this.hasEstablishedBaseline = false;
      this.baselineHistory = [];
      
      // Restablecer todos los buffers de análisis
      this.periodicityBuffer = [];
      this.pulsationPatternBuffer = [];
      this.intensityHistory = [];
      this.lastFramesVariation = [];
      
      // Registrar que estamos en modo calibración
      console.log("PPGSignalProcessor: Calibración preparada - esperando primeros frames para línea base");
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
      // Incrementar contador de frames global
      this.frameCounter++;
      
      // Extraer canal rojo (principal para PPG)
      const redValue = this.extractRedChannel(imageData);
      
      // Recolectar datos de baseline antes de empezar a procesar
      if (!this.hasEstablishedBaseline) {
        this.collectBaseline(redValue);
        
        // No procesar aún si no hay baseline
        if (!this.hasEstablishedBaseline) {
          // Notificar que estamos en fase de calibración
          const calibrationSignal: ProcessedSignal = {
            timestamp: Date.now(),
            rawValue: redValue,
            filteredValue: 0,
            quality: 0,
            fingerDetected: false,
            roi: this.detectROI(redValue),
            physicalSignatureScore: 0
          };
          this.onSignalReady?.(calibrationSignal);
          return;
        }
      }
      
      // Rechazar inmediatamente si los valores están fuera de rango
      if (redValue < this.MIN_RED_THRESHOLD || redValue > this.MAX_RED_THRESHOLD) {
        this.updateDetectionHistory(false);
        const poorSignal: ProcessedSignal = {
          timestamp: Date.now(),
          rawValue: redValue,
          filteredValue: 0,
          quality: 0,
          fingerDetected: false,
          roi: this.detectROI(redValue),
          physicalSignatureScore: 0
        };
        this.onSignalReady?.(poorSignal);
        return;
      }
      
      // Aplicar denoising
      const denoisedValue = this.applyWaveletDenoising(redValue);
      
      // Filtrar con Kalman
      const filtered = this.kalmanFilter.filter(denoisedValue);
      
      // Registrar variación entre frames consecutivos
      this.trackFrameVariation(filtered);
      
      // Registrar los valores de intensidad
      this.trackIntensityVariation(redValue);
      
      // Registrar el patrón de pulsación
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
      
      // Actualizar historial de detección
      this.updateDetectionHistory(isFingerDetected);
      
      // Aplicar lógica de histéresis para evitar falsos positivos
      const robustDetection = this.applyDetectionHysteresis();
      
      // Ajustar calidad basada en la robustez de la detección
      const adjustedQuality = robustDetection ? quality : 0;
      
      // Aplicar umbral mínimo de frames para detección inicial
      const finalDetection = robustDetection && this.frameCounter > this.MIN_FRAMES_BEFORE_DETECTION;

      // Crear señal procesada final
      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: adjustedQuality,
        fingerDetected: finalDetection,
        roi: this.detectROI(redValue),
        physicalSignatureScore: physicalSignatureScore
      };

      // Logs detallados para depuración
      console.log("PPGSignalProcessor: Análisis completo", {
        rawValue: redValue,
        filteredValue: filtered.toFixed(2),
        initialDetection: isFingerDetected,
        robustDetection,
        finalDetection,
        rawQuality: quality,
        adjustedQuality,
        physicalScore: physicalSignatureScore,
        frameCount: this.frameCounter,
        detectionRatio: this.calculateDetectionRatio(),
        timestamp: new Date().toISOString()
      });

      // Enviar señal procesada
      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  /**
   * Nueva función: Recolecta valores de baseline para establecer referencia
   */
  private collectBaseline(value: number): void {
    this.baselineHistory.push(value);
    
    if (this.baselineHistory.length > this.BASELINE_HISTORY_SIZE) {
      this.baselineHistory.shift();
      
      // Calcular estadísticas del baseline
      const avg = this.baselineHistory.reduce((sum, v) => sum + v, 0) / this.baselineHistory.length;
      const variance = this.baselineHistory.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / this.baselineHistory.length;
      const stdDev = Math.sqrt(variance);
      
      // Establecer baseline solo si los valores son estables (baja variación)
      if (stdDev < 10) {
        this.hasEstablishedBaseline = true;
        this.baselineValue = avg;
        console.log("PPGSignalProcessor: Baseline establecido", {
          valor: this.baselineValue,
          desviación: stdDev,
          frameCount: this.frameCounter
        });
      }
    }
  }

  /**
   * Nueva función: Actualiza el historial de detección
   */
  private updateDetectionHistory(detected: boolean): void {
    this.detectionHistory.push(detected);
    if (this.detectionHistory.length > this.DETECTION_HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
  }

  /**
   * Nueva función: Aplica histéresis para evitar detecciones intermitentes
   */
  private applyDetectionHysteresis(): boolean {
    if (this.detectionHistory.length < 5) return false;
    
    const ratio = this.calculateDetectionRatio();
    return ratio >= this.MIN_DETECTION_RATIO;
  }

  /**
   * Nueva función: Calcula ratio de detección en el historial
   */
  private calculateDetectionRatio(): number {
    if (this.detectionHistory.length === 0) return 0;
    
    const trueCount = this.detectionHistory.filter(value => value).length;
    return trueCount / this.detectionHistory.length;
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
   * Evalúa si la señal tiene características físicas de un dedo real
   * Con criterios más estrictos
   */
  private analyzePhysicalSignature(): number {
    if (this.lastFramesVariation.length < this.FRAMES_VARIATION_SIZE * 0.7 ||
        this.intensityHistory.length < this.INTENSITY_HISTORY_SIZE * 0.7 ||
        this.pulsationPatternBuffer.length < this.PULSATION_BUFFER_SIZE * 0.7) {
      return 0;
    }
    
    // 1. Análisis de Variación Temporal - Más estricto
    const avgVariation = this.lastFramesVariation.reduce((sum, v) => sum + v, 0) / 
                         this.lastFramesVariation.length;
    
    const significantVariations = this.lastFramesVariation.filter(v => v > this.MIN_VALID_VARIATION).length;
    const variationRatio = significantVariations / this.lastFramesVariation.length;
    
    // 2. Análisis de Variación de Intensidad - Más estricto
    const maxIntensity = Math.max(...this.intensityHistory);
    const minIntensity = Math.min(...this.intensityHistory);
    const intensityRange = maxIntensity - minIntensity;
    
    // 3. Análisis de Frecuencia de Pulsación - Más preciso
    const pulsationScore = this.analyzeSignalFrequencies();
    
    // 4. Análisis de Perfil de Cambio - Más riguroso
    const changeProfile = this.analyzeChangeProfile();
    
    // Combinar todos los factores para un score físico global
    // Con pesos ajustados para mayor exigencia
    const variationScore = (avgVariation > this.MIN_VALID_VARIATION && variationRatio > this.MAX_STATIC_RATIO) ? 
                          Math.min(1.0, avgVariation / (this.MIN_VALID_VARIATION * 2)) : 0;
    
    const intensityScore = intensityRange > this.MIN_INTENSITY_VARIATION ? 
                          Math.min(1.0, intensityRange / (this.MIN_INTENSITY_VARIATION * 2)) : 0;
    
    // Puntuación combinada - Mayor peso a los patrones de pulsación y variación
    const combinedScore = 
      variationScore * 0.30 + 
      intensityScore * 0.15 + 
      pulsationScore * 0.40 + 
      changeProfile * 0.15;
    
    // Penalizar severamente puntuaciones bajas - no escala lineal
    const adjustedScore = combinedScore >= 0.6 ? combinedScore : combinedScore * 0.5;
    
    console.log("PPGSignalProcessor: Análisis físico detallado", {
      variationScore: variationScore.toFixed(2),
      intensityScore: intensityScore.toFixed(2),
      pulsationScore: pulsationScore.toFixed(2),
      changeProfile: changeProfile.toFixed(2),
      combinedScore: combinedScore.toFixed(2),
      adjustedScore: adjustedScore.toFixed(2)
    });
    
    return adjustedScore;
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
      
      if (denominator > 0) {
        correlation /= Math.sqrt(denominator);
        correlations.push(Math.abs(correlation));
      } else {
        correlations.push(0);
      }
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
   * Mejora: Análisis de múltiples regiones para mayor precisión
   */
  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    
    // Analizar varias regiones con diferentes pesos
    const regions = [
      // Centro (peso alto)
      {
        startX: Math.floor(imageData.width * 0.4),
        endX: Math.floor(imageData.width * 0.6),
        startY: Math.floor(imageData.height * 0.4),
        endY: Math.floor(imageData.height * 0.6),
        weight: 0.7
      },
      // Alrededor del centro (peso medio)
      {
        startX: Math.floor(imageData.width * 0.3),
        endX: Math.floor(imageData.width * 0.7),
        startY: Math.floor(imageData.height * 0.3),
        endY: Math.floor(imageData.height * 0.7),
        weight: 0.3
      }
    ];
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    // Procesar cada región
    for (const region of regions) {
      let redSum = 0;
      let count = 0;
      
      for (let y = region.startY; y < region.endY; y++) {
        for (let x = region.startX; x < region.endX; x++) {
          const i = (y * imageData.width + x) * 4;
          redSum += data[i];  // Canal rojo
          count++;
        }
      }
      
      if (count > 0) {
        const avgRed = redSum / count;
        weightedSum += avgRed * region.weight;
        totalWeight += region.weight;
        
        // Registrar valores para depuración
        console.log(`PPGSignalProcessor: Región [${region.startX}-${region.endX}, ${region.startY}-${region.endY}]`, {
          avgRed: avgRed.toFixed(2),
          weight: region.weight,
          pixelCount: count
        });
      }
    }
    
    // Resultado ponderado final
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
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
   * Con criterios mucho más estrictos
   */
  private analyzeSignal(filtered: number, rawValue: number): { 
    isFingerDetected: boolean, 
    quality: number, 
    physicalSignatureScore: number
  } {
    // Verificar que estamos en el rango adecuado de valores
    const isInRange = rawValue >= this.MIN_RED_THRESHOLD && rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0, physicalSignatureScore: 0 };
    }

    // Verificar que tenemos suficientes datos
    if (this.lastValues.length < this.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0, physicalSignatureScore: 0 };
    }

    // Analizar estabilidad
    const recentValues = this.lastValues.slice(-this.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calcular variaciones entre frames consecutivos
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Análisis estadístico más riguroso
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    const avgVariation = variations.reduce((sum, val) => sum + Math.abs(val), 0) / variations.length;
    
    // Umbral adaptativo más estricto
    const adaptiveThreshold = Math.max(1.2, avgValue * 0.02);
    
    // Criterios de estabilidad más exigentes
    const isStable = maxVariation < adaptiveThreshold * 1.8 && 
                    minVariation > -adaptiveThreshold * 1.8 &&
                    avgVariation > adaptiveThreshold * 0.2; // Exigir un mínimo de variación

    // Actualizar contador de estabilidad con más castigo por inestabilidad
    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 0.8, this.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1.2);
    }

    // Análisis físico para distinguir dedos reales de objetos estáticos
    const physicalSignatureScore = this.analyzePhysicalSignature();
    
    // Análisis de periodicidad
    const periodicityScore = this.analyzeSignalPeriodicity();
    
    // Calculamos la calidad con criterios más exigentes
    let quality = 0;
    
    if (this.stableFrameCount >= (this.MIN_STABILITY_COUNT * 0.75)) {
      const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - this.MIN_RED_THRESHOLD) / 
                                    (this.MAX_RED_THRESHOLD - this.MIN_RED_THRESHOLD), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 3)));
      
      // La calidad depende FUERTEMENTE del score físico
      // Se aplica una función de potencia para penalizar scores físicos bajos
      const physicalSignatureModifier = Math.pow(physicalSignatureScore, 1.8);
      
      // Cálculo de calidad que exige características fisiológicas
      quality = Math.round((
        stabilityScore * 0.2 + 
        intensityScore * 0.15 + 
        variationScore * 0.15 + 
        periodicityScore * 0.5) * 100 * physicalSignatureModifier);
    }
    
    // Para detección del dedo, exigir alta periodicidad y score físico
    const isFingerDetected = 
      this.stableFrameCount >= this.MIN_STABILITY_COUNT && 
      periodicityScore > this.MIN_PERIODICITY_SCORE &&
      physicalSignatureScore > 0.45;

    return { 
      isFingerDetected, 
      quality, 
      physicalSignatureScore 
    };
  }

  /**
   * Analiza la periodicidad de la señal
   * Con mayor exigencia para características cardíacas
   */
  private analyzeSignalPeriodicity(): number {
    if (this.periodicityBuffer.length < 30) {
      return 0;
    }
    
    const signal = this.periodicityBuffer.slice(-30);
    const signalMean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    
    const normalizedSignal = signal.map(val => val - signalMean);
    
    // Análisis espectral simplificado
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
    
    // Buscar periodicidad en rango cardíaco humano (típicamente 4-15 frames por ciclo)
    let maxCorrelation = 0;
    let periodFound = false;
    
    for (let i = 4; i <= 15; i++) {
      if (i < correlations.length && 
          correlations[i] > correlations[Math.max(0, i-1)] && 
          correlations[i] > correlations[Math.min(correlations.length-1, i+1)] && 
          correlations[i] > 0.25) {
        
        if (correlations[i] > maxCorrelation) {
          maxCorrelation = correlations[i];
          periodFound = true;
        }
      }
    }
    
    if (periodFound) {
      // Recompensa para correlaciones fuertes
      return Math.pow(Math.min(1.0, maxCorrelation), 0.8);
    } else {
      // Penalización severa si no hay periodicidad
      return 0;
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
