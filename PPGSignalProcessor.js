
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
    MIN_RED_THRESHOLD: 100,  // AUMENTADO SIGNIFICATIVAMENTE (era 80)
    MAX_RED_THRESHOLD: 245,
    STABILITY_WINDOW: 6,    // AUMENTADO (era 4) para mayor estabilidad
    MIN_STABILITY_COUNT: 5  // AUMENTADO (era 3) para evitar falsas detecciones
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private readonly BUFFER_SIZE = 10;
  private readonly MIN_RED_THRESHOLD = 110; // AUMENTADO (era 85)
  private readonly MAX_RED_THRESHOLD = 245;
  private readonly STABILITY_WINDOW = 6; // AUMENTADO (era 5)
  private readonly MIN_STABILITY_COUNT = 5; // AUMENTADO (era 3)
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.065; // AUMENTADO (era 0.045)
  
  // NUEVAS VARIABLES para detección más estricta
  private fingerDetectionHistory: boolean[] = [];
  private readonly DETECTION_HISTORY_SIZE = 15; // Historial amplio para evitar oscilaciones
  private readonly MIN_DETECTION_RATIO = 0.7; // 70% de frames deben detectar dedo
  private baselineValues: number[] = [];
  private readonly BASELINE_SIZE = 8;
  private lastAmbientLight: number = 0;
  private redValuesHistory: number[] = [];
  private readonly RED_HISTORY_SIZE = 20;
  private physicalSignatureScore: number = 0;

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
      
      // Reiniciar nuevas variables
      this.fingerDetectionHistory = [];
      this.baselineValues = [];
      this.lastAmbientLight = 0;
      this.redValuesHistory = [];
      this.physicalSignatureScore = 0;
      
      console.log("PPGSignalProcessor: Inicializado con parámetros más estrictos");
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
    
    // Limpiar nuevas variables
    this.fingerDetectionHistory = [];
    this.baselineValues = [];
    this.redValuesHistory = [];
    this.physicalSignatureScore = 0;
    
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración");
      await this.initialize();

      // Capturar línea base ambiental para mejor comparación
      this.captureAmbientBaseline();
      
      // Simulamos el proceso de calibración
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Ajustamos los umbrales basados en condiciones ambientales
      const baselineAvg = this.baselineValues.length > 0 
        ? this.baselineValues.reduce((a, b) => a + b, 0) / this.baselineValues.length 
        : 0;
      
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        // Ajuste adaptativo basado en luz ambiental
        MIN_RED_THRESHOLD: Math.max(100, baselineAvg + 30), // Asegurarse de que sea significativamente mayor que el ambiente
        MAX_RED_THRESHOLD: Math.min(255, this.MAX_RED_THRESHOLD),
        STABILITY_WINDOW: this.STABILITY_WINDOW,
        MIN_STABILITY_COUNT: this.MIN_STABILITY_COUNT
      };

      console.log("PPGSignalProcessor: Calibración completada", {
        configuración: this.currentConfig,
        baselineAmbiental: baselineAvg
      });
      return true;
    } catch (error) {
      console.error("PPGSignalProcessor: Error de calibración", error);
      this.handleError("CALIBRATION_ERROR", "Error durante la calibración");
      return false;
    }
  }
  
  // NUEVA FUNCIÓN: Captura valores de línea base ambiental
  private captureAmbientBaseline(): void {
    // Implementar en el dispositivo real con primera captura de frame
    this.lastAmbientLight = 0; // Se actualizará con valor real
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
      
      // NUEVO: Actualizar historial de valores rojos para análisis
      this.redValuesHistory.push(redValue);
      if (this.redValuesHistory.length > this.RED_HISTORY_SIZE) {
        this.redValuesHistory.shift();
      }
      
      // NUEVO: Capturar línea base en primeros frames
      if (this.baselineValues.length < this.BASELINE_SIZE) {
        this.baselineValues.push(redValue);
        // No continuar procesando hasta tener suficientes datos de línea base
        if (this.baselineValues.length < this.BASELINE_SIZE) {
          return;
        }
      }
      
      const filtered = this.kalmanFilter.filter(redValue);
      this.lastValues.push(filtered);
      
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // Análisis mejorado con firma física
      const physicalAnalysis = this.analyzePhysicalSignature(this.redValuesHistory);
      this.physicalSignatureScore = physicalAnalysis.score;
      
      // Análisis principal con detección más estricta
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);
      
      // NUEVO: Actualizar historial de detección
      this.fingerDetectionHistory.push(isFingerDetected);
      if (this.fingerDetectionHistory.length > this.DETECTION_HISTORY_SIZE) {
        this.fingerDetectionHistory.shift();
      }
      
      // NUEVO: Decisión robusta basada en historial
      const robustDetection = this.getRobustDetection();
      
      // Calidad final ajustada por firma física
      const finalQuality = robustDetection ? 
        Math.round(quality * this.physicalSignatureScore) : 0;

      console.log("PPGSignalProcessor: Análisis", {
        redValue,
        filtered,
        deteccionInicial: isFingerDetected,
        deteccionRobusta: robustDetection,
        quality,
        calidadFinal: finalQuality,
        firmaFisica: this.physicalSignatureScore.toFixed(2)
      });

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: finalQuality,
        fingerDetected: robustDetection,
        roi: this.detectROI(redValue),
        physicalSignatureScore: this.physicalSignatureScore
      };

      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  // NUEVA FUNCIÓN: Análisis de firma física
  private analyzePhysicalSignature(redValues: number[]): { score: number, isPulsatile: boolean } {
    if (redValues.length < 10) {
      return { score: 0, isPulsatile: false };
    }
    
    // Análisis de variaciones temporales (pulsatilidad)
    const deltas: number[] = [];
    for (let i = 1; i < redValues.length; i++) {
      deltas.push(redValues[i] - redValues[i-1]);
    }
    
    // Verificar alternancia de signo (característica clave de señal PPG)
    let signChanges = 0;
    for (let i = 1; i < deltas.length; i++) {
      if ((deltas[i] > 0 && deltas[i-1] < 0) || (deltas[i] < 0 && deltas[i-1] > 0)) {
        signChanges++;
      }
    }
    
    // Calcular frecuencia de cambios de signo (debería estar en rango fisiológico)
    const changeRate = signChanges / deltas.length;
    
    // Rango esperado para pulso cardíaco (0.1 - 0.4 para señal muestreada a ~30fps)
    const isPulsatile = changeRate >= 0.1 && changeRate <= 0.4;
    
    // Varianza total (la señal PPG tiene cierta variabilidad característica)
    const mean = redValues.reduce((a, b) => a + b, 0) / redValues.length;
    const variance = redValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / redValues.length;
    const normalizedVariance = Math.min(1, variance / 200); // Normalizar en rango razonable
    
    // Combinar factores para score final
    let score = 0;
    if (isPulsatile) {
      // Factor primario: rango de cambio de signo en frecuencia cardíaca
      const optimalChangeRate = 0.25; // ~70-80bpm a 30fps
      const changeRateFactor = 1 - Math.min(1, Math.abs(changeRate - optimalChangeRate) / 0.15);
      
      // Factor secundario: varianza apropiada (ni muy alta ni muy baja)
      const varianceFactor = normalizedVariance > 0.05 && normalizedVariance < 0.5 ? 
        1 - Math.abs(normalizedVariance - 0.2) : 0;
      
      // Score combinado
      score = 0.7 * changeRateFactor + 0.3 * varianceFactor;
    }
    
    return { 
      score: Math.max(0, Math.min(1, score)), 
      isPulsatile
    };
  }

  // NUEVA FUNCIÓN: Obtener decisión robusta basada en historial
  private getRobustDetection(): boolean {
    if (this.fingerDetectionHistory.length < 5) return false;
    
    const trueCount = this.fingerDetectionHistory.filter(x => x).length;
    const detectionRatio = trueCount / this.fingerDetectionHistory.length;
    
    // NUEVO: También verificar firma física para asegurar que es un dedo real
    const isPhysicallyValid = this.physicalSignatureScore > 0.4;
    
    return detectionRatio >= this.MIN_DETECTION_RATIO && isPhysicallyValid;
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

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    // MUCHO MÁS ESTRICTO: verificar umbral mínimo contra baseline
    const baselineAvg = this.baselineValues.length > 0 
      ? this.baselineValues.reduce((a, b) => a + b, 0) / this.baselineValues.length 
      : 0;
    
    // Si está muy cerca del valor base ambiental, NO hay dedo
    if (rawValue < baselineAvg + 20) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }
    
    // Verificar contra umbrales configurados (ahora más estrictos)
    const isInRange = rawValue >= this.currentConfig.MIN_RED_THRESHOLD && 
                      rawValue <= this.currentConfig.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    // Verificar estabilidad con ventana más grande
    if (this.lastValues.length < this.currentConfig.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    // Mejora en detección de estabilidad para picos cardíacos
    const recentValues = this.lastValues.slice(-this.currentConfig.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Análisis mejorado de variación para detectar picos
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    // Detección más sensible de picos cardíacos
    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    // Umbrales adaptativos más estrictos
    const adaptiveThreshold = Math.max(2.5, avgValue * 0.03); // Aumentado de 1.5 a 2.5
    const isStable = maxVariation < adaptiveThreshold * 2 && 
                    minVariation > -adaptiveThreshold * 2;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.currentConfig.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      // Reducción más rápida para ser más sensible a inestabilidad
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 1);
    }

    // MUCHO MÁS ESTRICTO en detección inicial
    const isFingerDetected = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      // Cálculo de calidad mejorado
      const stabilityScore = Math.min(this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - this.currentConfig.MIN_RED_THRESHOLD) / 
                                    (this.currentConfig.MAX_RED_THRESHOLD - this.currentConfig.MIN_RED_THRESHOLD), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 3)));
      
      quality = Math.round((stabilityScore * 0.4 + intensityScore * 0.3 + variationScore * 0.3) * 100);
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
