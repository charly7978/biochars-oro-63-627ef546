import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';

class KalmanFilter {
  private R: number = 0.007; // Reducido para menor ruido
  private Q: number = 0.13;  // Aumentado para mejor seguimiento de cambios rápidos
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
    BUFFER_SIZE: 15,  // Aumentado para mejor análisis
    MIN_RED_THRESHOLD: 80,  // Volvemos a un nivel más estricto para evitar falsos positivos
    MAX_RED_THRESHOLD: 245,
    STABILITY_WINDOW: 5,    // Aumentado para exigir mayor estabilidad
    MIN_STABILITY_COUNT: 3  // Volvemos a un valor más estricto
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private readonly BUFFER_SIZE = 15; // Actualizado
  private readonly MIN_RED_THRESHOLD = 80; // Actualizado
  private readonly MAX_RED_THRESHOLD = 245;
  private readonly STABILITY_WINDOW = 5;
  private readonly MIN_STABILITY_COUNT = 3; // Actualizado
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05; // Aumentado para mayor especificidad

  // Variables para adaptación dinámica
  private dynamicThreshold: number = 0;
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 25; // Aumentado para análisis más preciso
  private readonly ADAPTATION_RATE = 0.1; // Reducido para cambios más graduales
  
  // Nuevas variables para análisis espectral
  private frequencyAnalysisSamples: number[] = [];
  private readonly SPECTRUM_WINDOW = 100; // Ventana para análisis espectral
  private lastSpectrumAnalysisTime: number = 0;
  private readonly SPECTRUM_ANALYSIS_INTERVAL = 1000; // 1 segundo entre análisis

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
      this.signalHistory = [];
      this.dynamicThreshold = 0;
      this.frequencyAnalysisSamples = [];
      this.lastSpectrumAnalysisTime = 0;
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
    this.signalHistory = [];
    this.dynamicThreshold = 0;
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración");
      await this.initialize();

      // Simulamos el proceso de calibración
      await new Promise(resolve => setTimeout(resolve, 1800));
      
      // Ajustamos los umbrales basados en las condiciones actuales
      this.currentConfig = {
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: Math.max(70, this.MIN_RED_THRESHOLD - 10), // Más permisivo en calibración
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
      const filtered = this.kalmanFilter.filter(redValue);
      this.lastValues.push(filtered);
      
      // Actualizar muestras para análisis espectral
      this.frequencyAnalysisSamples.push(filtered);
      if (this.frequencyAnalysisSamples.length > this.SPECTRUM_WINDOW) {
        this.frequencyAnalysisSamples.shift();
      }
      
      // Actualizar historial para adaptación dinámica
      this.signalHistory.push(filtered);
      if (this.signalHistory.length > this.HISTORY_SIZE) {
        this.signalHistory.shift();
      }
      
      // Actualizar umbral dinámico si tenemos suficientes datos
      if (this.signalHistory.length >= this.HISTORY_SIZE / 2) {
        this.updateDynamicThreshold();
      }
      
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      // Realizar análisis
      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);
      const perfusionIndex = this.calculatePerfusionIndex();
      
      // Realizar análisis espectral periódicamente
      const now = Date.now();
      let spectrumData = undefined;
      
      if (now - this.lastSpectrumAnalysisTime > this.SPECTRUM_ANALYSIS_INTERVAL && 
          this.frequencyAnalysisSamples.length >= this.SPECTRUM_WINDOW / 2) {
        spectrumData = this.performSpectrumAnalysis();
        this.lastSpectrumAnalysisTime = now;
      }

      console.log("PPGSignalProcessor: Análisis", {
        redValue,
        filtered,
        isFingerDetected,
        quality,
        stableFrames: this.stableFrameCount,
        perfusionIndex,
        dynamicThreshold: this.dynamicThreshold,
        hasSpectrum: !!spectrumData
      });

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue),
        perfusionIndex,
        spectrumData
      };

      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  /**
   * Nuevo método para análisis espectral (FFT simplificado)
   * Identifica frecuencias dominantes en la señal
   */
  private performSpectrumAnalysis(): ProcessedSignal['spectrumData'] {
    if (this.frequencyAnalysisSamples.length < 30) return undefined;
    
    // Detrend (eliminar tendencia) para mejorar análisis frecuencial
    const samples = [...this.frequencyAnalysisSamples];
    const mean = samples.reduce((sum, val) => sum + val, 0) / samples.length;
    const detrended = samples.map(val => val - mean);
    
    // Estimación de frecuencias usando autocorrelación (simplificado)
    const maxLag = Math.min(50, Math.floor(detrended.length / 2));
    const correlations: number[] = [];
    
    // Calcular autocorrelación para diferentes lags
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < detrended.length - lag; i++) {
        sum += detrended[i] * detrended[i + lag];
      }
      correlations.push(sum);
    }
    
    // Normalizar
    const maxCorr = Math.max(...correlations);
    const normalizedCorr = correlations.map(c => c / maxCorr);
    
    // Buscar picos (potenciales períodos)
    const peaks: number[] = [];
    for (let i = 1; i < normalizedCorr.length - 1; i++) {
      if (normalizedCorr[i] > normalizedCorr[i-1] && 
          normalizedCorr[i] > normalizedCorr[i+1] &&
          normalizedCorr[i] > 0.5) { // Umbral de significancia
        peaks.push(i + 1); // +1 porque i es el índice, lag = i + 1
      }
    }
    
    // Estimar frecuencias desde períodos (lags)
    // Asumiendo 30 FPS (frecuencia de muestreo aproximada)
    const samplingRate = 30;
    const frequencies: number[] = peaks.map(lag => samplingRate / lag);
    
    // Filtrar frecuencias fisiol��gicamente plausibles (0.7-3 Hz ≈ 42-180 BPM)
    const validFreqs = frequencies.filter(f => f >= 0.7 && f <= 3.0);
    
    // Calcular amplitudes normalizadas para las frecuencias válidas
    const amplitudes = validFreqs.map(f => {
      const lag = Math.round(samplingRate / f);
      const idx = lag - 1;
      return idx >= 0 && idx < normalizedCorr.length ? normalizedCorr[idx] : 0;
    });
    
    // Encontrar frecuencia dominante (la de mayor amplitud)
    let dominantFreq = 0;
    let maxAmp = -1;
    
    for (let i = 0; i < validFreqs.length; i++) {
      if (amplitudes[i] > maxAmp) {
        maxAmp = amplitudes[i];
        dominantFreq = validFreqs[i];
      }
    }
    
    // Convertir frecuencias a BPM para mayor claridad
    const freqsBPM = validFreqs.map(f => f * 60);
    
    return {
      frequencies: freqsBPM,
      amplitudes,
      dominantFrequency: dominantFreq * 60 // Convertir a BPM
    };
  }

  private updateDynamicThreshold(): void {
    const min = Math.min(...this.signalHistory);
    const max = Math.max(...this.signalHistory);
    const range = max - min;
    
    // Calcular nuevo umbral basado en el rango de la señal
    const newThreshold = range * 0.25; // 25% del rango como umbral
    
    // Actualizar dinámicamente con suavizado
    if (this.dynamicThreshold === 0) {
      this.dynamicThreshold = newThreshold;
    } else {
      this.dynamicThreshold = (1 - this.ADAPTATION_RATE) * this.dynamicThreshold + 
                             this.ADAPTATION_RATE * newThreshold;
    }
  }

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

  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let count = 0;
    
    // Analizar solo el centro de la imagen (30% central)
    const startX = Math.floor(imageData.width * 0.35);
    const endX = Math.floor(imageData.width * 0.65);
    const startY = Math.floor(imageData.height * 0.35);
    const endY = Math.floor(imageData.height * 0.65);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];    // Canal rojo
        greenSum += data[i+1]; // Canal verde
        count++;
      }
    }
    
    // Nuevo: calcular relación rojo/verde para detección fisiológica
    const avgRed = redSum / count;
    const avgGreen = greenSum / count;
    
    // Las yemas de dedos tienen características ópticas específicas:
    // - Mayor absorción en rojo que en verde por la presencia de sangre
    const redGreenRatio = avgRed / (avgGreen || 1);
    
    // Penalizar valores no fisiológicos
    if (redGreenRatio < 1.1 || redGreenRatio > 2.2) {
      console.log("Proporción R/G no fisiológica:", redGreenRatio);
      // No devolvemos valor 0 para permitir que nuestros algoritmos adaptativos funcionen
      // pero reducimos la intensidad para que sea menos probable que active la detección
      return avgRed * 0.7;
    }
    
    return avgRed;
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    // Usar umbral dinámico si está disponible, o caer en el valor estático
    const effectiveThreshold = this.dynamicThreshold > 0 ? 
                              this.dynamicThreshold : 
                              this.MIN_RED_THRESHOLD;
                              
    // Invertimos la lógica: si el valor está fuera del rango, NO hay dedo
    const isInRange = rawValue >= effectiveThreshold && rawValue <= this.MAX_RED_THRESHOLD;
    
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
    
    // Análisis de periodicidad (clave para señales cardíacas reales)
    let periodicityScore = 0;
    
    if (variations.length > 6) {
      // Buscar patrón periódico en las variaciones (signo alternante)
      let signChanges = 0;
      let lastSign = Math.sign(variations[0]);
      
      for (let i = 1; i < variations.length; i++) {
        const currentSign = Math.sign(variations[i]);
        if (currentSign !== 0 && currentSign !== lastSign) {
          signChanges++;
          lastSign = currentSign;
        }
      }
      
      // Normalizar a 0-1 (óptimo entre 2-5 cambios para window=5)
      periodicityScore = Math.min(1, signChanges / 6);
    }
    
    // Umbrales adaptativos para mejor detección de picos
    const adaptiveThreshold = Math.max(1.3, avgValue * 0.02); // Ligeramente más estricto
    const isStable = maxVariation < adaptiveThreshold * 2.2 && 
                    minVariation > -adaptiveThreshold * 2.2 &&
                    periodicityScore > 0.2; // Mínima periodicidad requerida

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      // Reducción más rápida para rechazar patrones no cardíacos
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    // Ajuste en la lógica de detección del dedo
    const isFingerDetected = this.stableFrameCount >= this.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      // Cálculo de calidad mejorado
      const stabilityScore = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - effectiveThreshold) / 
                                    (this.MAX_RED_THRESHOLD - effectiveThreshold), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 3)));
      
      // Incluir periodicidad en el cálculo de calidad
      quality = Math.round((stabilityScore * 0.3 + intensityScore * 0.3 + 
                          variationScore * 0.2 + periodicityScore * 0.2) * 100);
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
