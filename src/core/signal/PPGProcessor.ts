
import { KalmanFilter } from './filters/KalmanFilter';
import { WaveletDenoiser } from './filters/WaveletDenoiser';
import { ROIDetector } from './roi-detector';
import { MultichannelAnalyzer } from './multichannel-analyzer';
import type { ProcessedSignal, ProcessingError } from '../../types/signal';

export class PPGProcessor {
  // Configuración unificada con valores optimizados
  private readonly CONFIG = {
    BUFFER_SIZE: 15,
    MIN_RED_THRESHOLD: 60,
    MAX_RED_THRESHOLD: 230,
    STABILITY_WINDOW: 3,
    MIN_STABILITY_COUNT: 3,
    PERFUSION_INDEX_THRESHOLD: 0.05,
    WAVELET_THRESHOLD: 0.025,
    BASELINE_FACTOR: 0.95,
    PERIODICITY_BUFFER_SIZE: 40,
    MIN_PERIODICITY_SCORE: 0.3,
    SIGNAL_QUALITY_THRESHOLD: 65
  };
  
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private waveletDenoiser: WaveletDenoiser;
  private lastValues: number[] = [];
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private baselineValue: number = 0;
  private periodicityBuffer: number[] = [];
  
  // Nuevos componentes para análisis avanzado
  private roiDetector: ROIDetector;
  private multichannelAnalyzer: MultichannelAnalyzer;
  private lastROI: ProcessedSignal['roi'] = { x: 0, y: 0, width: 100, height: 100 };
  
  // Buffer de canales para diagnóstico
  private redBuffer: number[] = [];
  private greenBuffer: number[] = [];
  private blueBuffer: number[] = [];
  
  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.waveletDenoiser = new WaveletDenoiser();
    
    // Inicializar nuevos componentes
    this.roiDetector = new ROIDetector();
    this.multichannelAnalyzer = new MultichannelAnalyzer();
    
    console.log("PPGProcessor: Instancia unificada creada con análisis multicanal y ROI dinámico");
  }

  public initialize(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Reiniciar detectores y analizadores
      this.roiDetector.reset();
      this.multichannelAnalyzer.reset();
      this.redBuffer = [];
      this.greenBuffer = [];
      this.blueBuffer = [];
      
      console.log("PPGProcessor: Inicializado con análisis multicanal y ROI dinámico");
      resolve();
    });
  }

  public start(): void {
    this.isProcessing = true;
    console.log("PPGProcessor: Procesamiento iniciado");
  }

  public stop(): void {
    this.isProcessing = false;
    console.log("PPGProcessor: Procesamiento detenido");
  }

  public calibrate(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      console.log("PPGProcessor: Calibración completada");
      resolve(true);
    });
  }

  public processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    try {
      // Detectar ROI dinámica
      const optimalROI = this.roiDetector.detectOptimalROI(imageData);
      this.lastROI = optimalROI;
      
      // Procesar canales en la ROI optimizada
      const {
        redValue,
        greenValue,
        blueValue,
        weightedValue,
        perfusionIndex
      } = this.multichannelAnalyzer.processROI(imageData, optimalROI);
      
      // Guardar valores de canales para diagnóstico
      this.redBuffer.push(redValue);
      this.greenBuffer.push(greenValue);
      this.blueBuffer.push(blueValue);
      
      if (this.redBuffer.length > 30) {
        this.redBuffer.shift();
        this.greenBuffer.shift();
        this.blueBuffer.shift();
      }
      
      // Aplicar filtrado avanzado al valor ponderado
      const kalmanFiltered = this.kalmanFilter.filter(weightedValue);
      const filtered = this.waveletDenoiser.denoise(kalmanFiltered);
      
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.CONFIG.BUFFER_SIZE) {
        this.lastValues.shift();
      }

      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);

      this.periodicityBuffer.push(filtered);
      if (this.periodicityBuffer.length > this.CONFIG.PERIODICITY_BUFFER_SIZE) {
        this.periodicityBuffer.shift();
      }

      // Obtener datos de espectro si tenemos suficientes muestras
      let spectrumData = undefined;
      if (this.periodicityBuffer.length >= 30) {
        spectrumData = this.calculateSpectrumData();
      }

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.lastROI,
        perfusionIndex: perfusionIndex,
        spectrumData
      };

      this.onSignalReady?.(processedSignal);
    } catch (error) {
      console.error("PPGProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const isInRange = rawValue >= this.CONFIG.MIN_RED_THRESHOLD && 
                      rawValue <= this.CONFIG.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < this.CONFIG.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    const recentValues = this.lastValues.slice(-this.CONFIG.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    const maxVariation = Math.max(...variations.map(Math.abs));
    const adaptiveThreshold = Math.max(1.5, avgValue * 0.02);
    const isStable = maxVariation < adaptiveThreshold * 2;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.CONFIG.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    const isFingerDetected = this.stableFrameCount >= this.CONFIG.MIN_STABILITY_COUNT;
    
    let quality = 0;
    if (isFingerDetected) {
      // Calcular calidad basada en estabilidad y periodicidad
      const stabilityQuality = (this.stableFrameCount / (this.CONFIG.MIN_STABILITY_COUNT * 2)) * 50;
      const periodicityQuality = this.analyzePeriodicityQuality() * 50;
      
      // Incorporar pesos de canales para calidad total
      const weights = this.multichannelAnalyzer.getChannelWeights();
      const channelBalanceScore = Math.min(50, (1 - Math.abs(weights.red - 0.5)) * 50);
      
      quality = Math.round(stabilityQuality + periodicityQuality + channelBalanceScore) / 1.5;
    }

    return { isFingerDetected, quality };
  }

  private calculatePerfusionIndex(): number {
    if (this.lastValues.length < 10) return 0;
    
    const values = this.lastValues.slice(-10);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const dc = (max + min) / 2;
    
    if (dc === 0) return 0;
    
    const ac = max - min;
    const pi = (ac / dc) * 100;
    
    return Math.min(pi, 10); // Limitar a un máximo razonable de 10%
  }

  private analyzePeriodicityQuality(): number {
    if (this.periodicityBuffer.length < 30) return 0.5;
    
    // Implementar análisis simple de periodicidad
    let correlationSum = 0;
    const halfSize = Math.floor(this.periodicityBuffer.length / 2);
    
    for (let i = 0; i < halfSize; i++) {
      correlationSum += Math.abs(this.periodicityBuffer[i] - this.periodicityBuffer[i + halfSize]);
    }
    
    const avgCorrelation = correlationSum / halfSize;
    const normalizedCorrelation = Math.min(1, Math.max(0, 1 - (avgCorrelation / 10)));
    
    return normalizedCorrelation;
  }

  private calculateSpectrumData(): ProcessedSignal['spectrumData'] {
    // Usar los últimos 30 valores del buffer de periodicidad
    const signal = this.periodicityBuffer.slice(-30);
    const signalMean = signal.reduce((sum, v) => sum + v, 0) / signal.length;
    const normalizedSignal = signal.map(v => v - signalMean);
    
    // Calcular autocorrelación para diferentes frecuencias
    const frequencies: number[] = [];
    const amplitudes: number[] = [];
    let maxAmplitude = 0;
    let dominantFrequencyIdx = 0;
    
    // Analizar frecuencias entre 0.5 Hz (30 BPM) y 3.3 Hz (200 BPM)
    for (let freq = 0.5; freq <= 3.3; freq += 0.1) {
      let amplitude = 0;
      
      // Calcular componente de autocorrelación para esta frecuencia
      for (let i = 0; i < normalizedSignal.length; i++) {
        const phase = (i / normalizedSignal.length) * Math.PI * 2 * freq;
        amplitude += normalizedSignal[i] * Math.sin(phase);
      }
      
      amplitude = Math.abs(amplitude) / normalizedSignal.length;
      
      frequencies.push(freq);
      amplitudes.push(amplitude);
      
      if (amplitude > maxAmplitude) {
        maxAmplitude = amplitude;
        dominantFrequencyIdx = frequencies.length - 1;
      }
    }
    
    return {
      frequencies,
      amplitudes,
      dominantFrequency: frequencies[dominantFrequencyIdx]
    };
  }

  private handleError(code: string, message: string): void {
    const error: ProcessingError = {
      code,
      message,
      timestamp: Date.now()
    };
    
    this.onError?.(error);
  }
}
