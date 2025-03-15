
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
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 90,     // PRIMERA VARIABLE MODIFICADA: aumentado de 75 a 90 para reducir falsos positivos
    MAX_RED_THRESHOLD: 255,
    STABILITY_WINDOW: 5,
    MIN_STABILITY_COUNT: 3,    // SEGUNDA VARIABLE MODIFICADA: aumentado de 2 a 3 para exigir mayor estabilidad
    HYSTERESIS: 5,
    MIN_CONSECUTIVE_DETECTIONS: 2
  };

  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private consecutiveDetections: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private readonly DETECTION_TIMEOUT = 1000; // Aumentado para mayor estabilidad
  private isAndroid: boolean = false;
  
  // Nuevas variables para análisis de consistencia de picos
  private peakValues: number[] = [];
  private readonly PEAK_HISTORY_SIZE = 5;
  private readonly PEAK_VARIANCE_THRESHOLD = 0.45; // Umbral permisivo de varianza para picos
  
  // Nuevas variables para análisis fisiológico
  private redValues: number[] = [];
  private greenValues: number[] = [];
  private readonly RGB_HISTORY_SIZE = 3;
  private readonly MIN_RG_RATIO = 1.1; // Umbral permisivo para relación rojo/verde
  
  // Debug information
  private lastDebugLog: number = 0;
  private readonly DEBUG_INTERVAL = 1000; // Log debug info every second

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.isAndroid = /android/i.test(navigator.userAgent);
    
    // Configuración ajustada para Android
    if (this.isAndroid) {
      this.currentConfig = { 
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: 80,  // Umbral mucho más bajo para Android
        BUFFER_SIZE: 10,        // Buffer más pequeño para procesamiento más rápido
        STABILITY_WINDOW: 4,    // Ventana más pequeña
        MIN_STABILITY_COUNT: 3  // Requerimiento de estabilidad menor
      };
    } else {
      this.currentConfig = { ...this.DEFAULT_CONFIG };
    }
    
    console.log("PPGSignalProcessor: Instancia creada con configuración específica para plataforma", {
      isAndroid: this.isAndroid,
      config: this.currentConfig
    });
  }

  async initialize(): Promise<void> {
    try {
      this.lastValues = [];
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      this.consecutiveDetections = 0;
      this.isCurrentlyDetected = false;
      this.lastDetectionTime = 0;
      this.kalmanFilter.reset();
      
      // Resetear variables de análisis de picos y fisiológico
      this.peakValues = [];
      this.redValues = [];
      this.greenValues = [];
      
      console.log("PPGSignalProcessor: Inicializado con configuración:", this.currentConfig);
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
    this.consecutiveDetections = 0;
    this.isCurrentlyDetected = false;
    this.kalmanFilter.reset();
    
    // Limpiar análisis de picos y fisiológico
    this.peakValues = [];
    this.redValues = [];
    this.greenValues = [];
    
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración");
      await this.initialize();
      
      // Configuración específica para Android vs otros
      if (this.isAndroid) {
        this.currentConfig = {
          ...this.DEFAULT_CONFIG,
          MIN_RED_THRESHOLD: 80,  // Umbral más alto para Android también
          MIN_STABILITY_COUNT: 3,  // Mayor exigencia
        };
      } else {
        // Para Windows/desktop
        this.currentConfig = {
          ...this.DEFAULT_CONFIG,
          MIN_RED_THRESHOLD: 95,  // Mucho más exigente para evitar falsos positivos
          MIN_STABILITY_COUNT: 3, // Mayor exigencia de estabilidad
        };
      }
      
      console.log("PPGSignalProcessor: Calibración completada con configuración:", this.currentConfig);
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Error de calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error durante la calibración");
      return false;
    }
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Extract and process the red channel
      const extractionResult = this.extractRedChannel(imageData);
      const redValue = extractionResult.redValue;
      
      // Log debug info periódicamente
      const now = Date.now();
      if (now - this.lastDebugLog > this.DEBUG_INTERVAL) {
        console.log("PPGSignalProcessor: Datos de extracción:", {
          redValue: redValue.toFixed(2),
          redGreenRatio: extractionResult.redGreenRatio.toFixed(2),
          brightness: extractionResult.brightness.toFixed(2),
          isRedDominant: extractionResult.isRedDominant,
          threshold: this.currentConfig.MIN_RED_THRESHOLD,
          isAndroid: this.isAndroid,
          time: new Date().toISOString()
        });
        this.lastDebugLog = now;
      }
      
      // Guardar valores RGB para análisis fisiológico
      this.redValues.push(extractionResult.avgRed);
      this.greenValues.push(extractionResult.avgGreen);
      
      // Mantener tamaño de historial
      if (this.redValues.length > this.RGB_HISTORY_SIZE) {
        this.redValues.shift();
        this.greenValues.shift();
      }
      
      // Aplicar Kalman filter para suavizar la señal
      const filtered = this.kalmanFilter.filter(redValue);
      
      // Analizar señal para determinar presencia de dedo y calidad
      const analysisResult = this.analyzeSignal(filtered, redValue);
      
      // Crear objeto de señal procesada
      const processedSignal: ProcessedSignal = {
        timestamp: now,
        rawValue: redValue,
        filteredValue: filtered,
        quality: analysisResult.quality,
        fingerDetected: analysisResult.isFingerDetected,
        roi: this.detectROI(redValue),
        perfusionIndex: redValue > 0 ? 
          Math.abs(filtered - this.lastStableValue) / Math.max(1, redValue) : 0
      };
      
      // Enviar señal procesada
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
      
      // Actualizar último valor estable
      if (analysisResult.isFingerDetected) {
        this.lastStableValue = filtered;
      }

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private extractRedChannel(imageData: ImageData): { 
    redValue: number, 
    isRedDominant: boolean,
    redGreenRatio: number,
    brightness: number,
    avgRed: number,
    avgGreen: number
  } {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    // Para Android, analizar un área mayor (50% del centro)
    const roiSize = this.isAndroid ? 
                    Math.min(imageData.width, imageData.height) * 0.5 :
                    Math.min(imageData.width, imageData.height) * 0.4;
    
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
    // Procesar todos los píxels en el ROI
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        const r = data[i];     // Canal rojo
        const g = data[i+1];   // Canal verde
        const b = data[i+2];   // Canal azul
        
        redSum += r;
        greenSum += g;
        blueSum += b;
        pixelCount++;
      }
    }
    
    // Calcular promedios
    const avgRed = pixelCount > 0 ? redSum / pixelCount : 0;
    const avgGreen = pixelCount > 0 ? greenSum / pixelCount : 0;
    const avgBlue = pixelCount > 0 ? blueSum / pixelCount : 0;
    
    // Calcular brillo general
    const brightness = (avgRed + avgGreen + avgBlue) / 3;
    
    // Para detección de dedo: rojo debe ser significativamente mayor que verde cuando hay dedo
    // Umbral más bajo para Android
    const redGreenThreshold = this.isAndroid ? 1.1 : 1.2;
    const redGreenRatio = avgGreen > 0 ? avgRed / avgGreen : 1;
    const isRedDominant = redGreenRatio > redGreenThreshold && 
                          avgRed > this.currentConfig.MIN_RED_THRESHOLD;
    
    return {
      redValue: isRedDominant ? avgRed : 0,
      isRedDominant,
      redGreenRatio,
      brightness,
      avgRed,
      avgGreen
    };
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const currentTime = Date.now();
    
    // Si no hay dominancia roja detectada (redValue = 0), definitivamente no hay dedo
    if (rawValue <= 0) {
      this.consecutiveDetections = 0;
      this.stableFrameCount = 0;
      this.isCurrentlyDetected = false;
      return { isFingerDetected: false, quality: 0 };
    }
    
    // Añadir valor al historial para análisis de estabilidad
    this.lastValues.push(filtered);
    if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
      this.lastValues.shift();
    }
    
    // Calcular estabilidad de la señal
    const stability = this.calculateStability();
    
    // Umbral de estabilidad más bajo para Android
    const stableThreshold = this.isAndroid ? 0.5 : 0.7;
    const mediumStableThreshold = this.isAndroid ? 0.3 : 0.5;
    
    // Actualizar contadores de estabilidad
    if (stability > stableThreshold) {
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else if (stability > mediumStableThreshold) {
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 0.5,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }
    
    // Determinar si la señal es suficientemente estable
    const isStableNow = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;
    
    // Nuevo: detectar picos para análisis de consistencia
    this.detectPeaks(filtered);
    
    // Actualizar contador de detecciones consecutivas
    if (isStableNow) {
      this.consecutiveDetections++;
      if (this.consecutiveDetections >= this.currentConfig.MIN_CONSECUTIVE_DETECTIONS) {
        this.isCurrentlyDetected = true;
        this.lastDetectionTime = currentTime;
      }
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 0.5);
      
      // Solo cancelar la detección después de un timeout
      if (currentTime - this.lastDetectionTime > this.DETECTION_TIMEOUT && 
          this.consecutiveDetections < 1) {
        this.isCurrentlyDetected = false;
      }
    }
    
    // Calcular calidad de señal
    let quality = 0;
    if (this.isCurrentlyDetected) {
      // Componentes de calidad
      const stabilityScore = Math.min(1, this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2));
      
      // Score por intensidad - optimizado para detección real de dedo
      const optimalValue = (this.currentConfig.MAX_RED_THRESHOLD + this.currentConfig.MIN_RED_THRESHOLD) / 2;
      const distanceFromOptimal = Math.abs(rawValue - optimalValue) / optimalValue;
      const intensityScore = Math.max(0, 1 - distanceFromOptimal);
      
      // Calcular score de variabilidad
      let variabilityScore = 0;
      if (this.lastValues.length >= 5) {
        const recentValues = this.lastValues.slice(-5);
        const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
        const diffs = recentValues.map(v => Math.abs(v - avg));
        const avgDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
        
        // Algo de variabilidad es buena (latido), pero no demasiada
        variabilityScore = avgDiff > 0.3 && avgDiff < 3 ? 1 : 
                          avgDiff < 0.1 ? 0.3 : 
                          avgDiff > 6 ? 0.2 : 
                          0.5;
      }
      
      // Nuevo: Score de consistencia de pico
      const peakConsistencyScore = this.calculatePeakConsistency();
      
      // Nuevo: Score de características fisiológicas
      const physiologicalScore = this.calculatePhysiologicalCharacteristics();
      
      // Combinar scores con diferentes pesos
      // Dar más peso a estabilidad en Android
      const rawQuality = this.isAndroid ?
                         (stabilityScore * 0.45 + 
                          intensityScore * 0.2 + 
                          variabilityScore * 0.1 +
                          peakConsistencyScore * 0.15 +
                          physiologicalScore * 0.1) :
                         (stabilityScore * 0.35 + 
                          intensityScore * 0.2 + 
                          variabilityScore * 0.15 +
                          peakConsistencyScore * 0.15 +
                          physiologicalScore * 0.15);
      
      quality = Math.round(rawQuality * 100);
    }
    
    return {
      isFingerDetected: this.isCurrentlyDetected,
      quality
    };
  }

  private calculateStability(): number {
    if (this.lastValues.length < 3) return 0;
    
    // Calcular variación entre valores consecutivos
    const variations = [];
    for (let i = 1; i < this.lastValues.length; i++) {
      variations.push(Math.abs(this.lastValues[i] - this.lastValues[i-1]));
    }
    
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
    
    // Umbral adaptativo para variación aceptable
    const threshold = this.isAndroid ? 8 : 5;
    const normalizedStability = Math.max(0, Math.min(1, 1 - (avgVariation / threshold)));
    
    return normalizedStability;
  }
  
  /**
   * Nuevo método: Detecta picos en la señal para análisis de consistencia
   */
  private detectPeaks(value: number): void {
    if (this.lastValues.length < 5) return;
    
    // Detectar pico simple (si el valor actual es un máximo local en ventana de 5)
    const recentValues = this.lastValues.slice(-5);
    const currentValue = recentValues[recentValues.length - 1];
    
    let isPeak = true;
    for (let i = 0; i < recentValues.length - 1; i++) {
      if (recentValues[i] >= currentValue) {
        isPeak = false;
        break;
      }
    }
    
    if (isPeak) {
      this.peakValues.push(value);
      if (this.peakValues.length > this.PEAK_HISTORY_SIZE) {
        this.peakValues.shift();
      }
    }
  }
  
  /**
   * Nuevo método: Calcula consistencia de picos en la señal
   */
  private calculatePeakConsistency(): number {
    if (this.peakValues.length < 3) return 0.5; // Score neutral con pocos datos
    
    const mean = this.peakValues.reduce((sum, val) => sum + val, 0) / this.peakValues.length;
    
    // Calcular variación normalizada
    const variance = this.peakValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.peakValues.length;
    const cv = Math.sqrt(variance) / Math.abs(mean);
    
    // Convertir a score (0-1)
    // Función suave: alta consistencia = alto score
    if (cv < this.PEAK_VARIANCE_THRESHOLD) {
      return 1 - (cv / this.PEAK_VARIANCE_THRESHOLD);
    } else {
      return Math.max(0.2, 0.5 - (cv - this.PEAK_VARIANCE_THRESHOLD));
    }
  }
  
  /**
   * Nuevo método: Analiza características fisiológicas de la señal
   */
  private calculatePhysiologicalCharacteristics(): number {
    if (this.redValues.length < 2 || this.greenValues.length < 2) return 0.5; // Score neutral
    
    // Calcular promedio de valores RGB
    const avgRed = this.redValues.reduce((sum, val) => sum + val, 0) / this.redValues.length;
    const avgGreen = this.greenValues.reduce((sum, val) => sum + val, 0) / this.greenValues.length;
    
    if (avgGreen <= 0) return 0.3; // Valores inválidos
    
    // Calcular relación R/G
    const rgRatio = avgRed / avgGreen;
    
    // Verificar si la relación está en rango fisiológico (no agresivo)
    // En tejido humano iluminado por flash, rojo debe ser mayor que verde
    if (rgRatio < this.MIN_RG_RATIO) {
      // Por debajo del mínimo esperado para piel
      return Math.max(0.2, 0.7 * (rgRatio / this.MIN_RG_RATIO));
    } else if (rgRatio > 2.0) {
      // Demasiado rojo, probablemente no es tejido humano
      return Math.max(0.2, 1 - ((rgRatio - 2.0) / 2.0));
    } else {
      // En rango óptimo
      return 0.8 + (0.2 * (1 - Math.abs(rgRatio - 1.5) / 0.5));
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
