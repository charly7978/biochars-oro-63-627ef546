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
    MIN_RED_THRESHOLD: 80,
    MAX_RED_THRESHOLD: 245,
    STABILITY_WINDOW: 4,
    MIN_STABILITY_COUNT: 3
  };
  private currentConfig: typeof this.DEFAULT_CONFIG;
  private readonly BUFFER_SIZE = 10;
  private readonly MIN_RED_THRESHOLD = 85;
  private readonly MAX_RED_THRESHOLD = 245;
  private readonly STABILITY_WINDOW = 5;
  private readonly MIN_STABILITY_COUNT = 3;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045;
  
  private baselineValue: number = 0;
  private readonly WAVELET_THRESHOLD = 0.025;
  private readonly BASELINE_FACTOR = 0.95;
  private periodicityBuffer: number[] = [];
  private readonly PERIODICITY_BUFFER_SIZE = 40;
  private readonly MIN_PERIODICITY_SCORE = 0.3;
  
  private signalSegments: number[][] = [];
  private readonly SEGMENT_SIZE = 5;
  private readonly MAX_SEGMENTS = 3;
  private readonly STABILITY_THRESHOLD = 0.4;
  
  private baselineHistory: number[] = [];
  private readonly BASELINE_HISTORY_SIZE = 15;
  private readonly MAX_BASELINE_DEVIATION = 0.15;
  private lastBaselineUpdate: number = 0;

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
      this.baselineValue = 0;
      this.periodicityBuffer = [];
      this.signalSegments = [];
      this.baselineHistory = [];
      this.lastBaselineUpdate = Date.now();
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
    this.baselineValue = 0;
    this.periodicityBuffer = [];
    this.signalSegments = [];
    this.baselineHistory = [];
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración");
      await this.initialize();

      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
      
      const denoisedValue = this.applyWaveletDenoising(redValue);
      
      const filtered = this.kalmanFilter.filter(denoisedValue);
      
      this.updateBaselineTracking(filtered);
      
      this.periodicityBuffer.push(filtered);
      if (this.periodicityBuffer.length > this.PERIODICITY_BUFFER_SIZE) {
        this.periodicityBuffer.shift();
      }
      
      this.lastValues.push(filtered);
      if (this.lastValues.length > this.BUFFER_SIZE) {
        this.lastValues.shift();
      }
      
      this.updateSignalStabilityAnalysis(filtered);

      const { isFingerDetected, quality } = this.analyzeSignal(filtered, redValue);

      const processedSignal: ProcessedSignal = {
        timestamp: Date.now(),
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue)
      };

      this.onSignalReady?.(processedSignal);

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private extractRedChannel(imageData: ImageData): number {
    const data = imageData.data;
    let redSum = 0;
    let count = 0;
    
    const startX = Math.floor(imageData.width * 0.375);
    const endX = Math.floor(imageData.width * 0.625);
    const startY = Math.floor(imageData.height * 0.375);
    const endY = Math.floor(imageData.height * 0.625);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        redSum += data[i];
        count++;
      }
    }
    
    const avgRed = redSum / count;
    return avgRed;
  }

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

  private updateBaselineTracking(value: number): void {
    this.baselineHistory.push(value);
    if (this.baselineHistory.length > this.BASELINE_HISTORY_SIZE) {
      this.baselineHistory.shift();
    }
    
    if (this.baselineHistory.length < 5) return;
    
    const recentValues = this.baselineHistory.slice(-5);
    const olderValues = this.baselineHistory.slice(0, 5);
    
    const recentAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const olderAvg = olderValues.reduce((sum, val) => sum + val, 0) / olderValues.length;
    
    const maxValue = Math.max(...this.baselineHistory);
    const minValue = Math.min(...this.baselineHistory);
    const range = Math.max(0.1, maxValue - minValue);
    
    const normalizedDeviation = Math.abs(recentAvg - olderAvg) / range;
    
    const now = Date.now();
    if (normalizedDeviation > this.MAX_BASELINE_DEVIATION && 
        now - this.lastBaselineUpdate > 500) {
      
      this.baselineValue = recentAvg;
      this.lastBaselineUpdate = now;
      
      console.log("PPGSignalProcessor: Significant baseline shift detected", {
        deviation: normalizedDeviation,
        threshold: this.MAX_BASELINE_DEVIATION,
        timeGap: now - this.lastBaselineUpdate
      });
    }
  }

  private updateSignalStabilityAnalysis(value: number): void {
    const currentSegmentIndex = Math.floor(this.lastValues.length / this.SEGMENT_SIZE);
    
    if (this.signalSegments.length <= currentSegmentIndex) {
      this.signalSegments.push([]);
    }
    
    this.signalSegments[currentSegmentIndex].push(value);
    
    while (this.signalSegments.length > this.MAX_SEGMENTS) {
      this.signalSegments.shift();
    }
    
    for (let i = 0; i < this.signalSegments.length; i++) {
      if (this.signalSegments[i].length > this.SEGMENT_SIZE) {
        this.signalSegments[i] = this.signalSegments[i].slice(-this.SEGMENT_SIZE);
      }
    }
  }

  private calculateSignalStabilityScore(): number {
    if (this.signalSegments.length < 2) return 0.5;
    
    const segmentStats = this.signalSegments.map(segment => {
      if (segment.length < 2) return { mean: 0, stdDev: 0 };
      
      const mean = segment.reduce((sum, val) => sum + val, 0) / segment.length;
      const variance = segment.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / segment.length;
      const stdDev = Math.sqrt(variance);
      
      return { mean, stdDev };
    });
    
    let stabilityScore = 0;
    let comparisons = 0;
    
    for (let i = 0; i < segmentStats.length - 1; i++) {
      for (let j = i + 1; j < segmentStats.length; j++) {
        const meanDiff = Math.abs(segmentStats[i].mean - segmentStats[j].mean);
        const stdDevDiff = Math.abs(segmentStats[i].stdDev - segmentStats[j].stdDev);
        
        const avgMean = (segmentStats[i].mean + segmentStats[j].mean) / 2;
        const avgStdDev = (segmentStats[i].stdDev + segmentStats[j].stdDev) / 2;
        
        const normalizedMeanDiff = avgMean === 0 ? 0 : meanDiff / Math.max(0.1, avgMean);
        const normalizedStdDevDiff = avgStdDev === 0 ? 0 : stdDevDiff / Math.max(0.1, avgStdDev);
        
        const pairStability = 1 - Math.min(1, (normalizedMeanDiff * 0.7 + normalizedStdDevDiff * 0.3));
        
        stabilityScore += pairStability;
        comparisons++;
      }
    }
    
    return comparisons > 0 ? stabilityScore / comparisons : 0.5;
  }

  private analyzeSignal(filtered: number, rawValue: number): { isFingerDetected: boolean, quality: number } {
    const isInRange = rawValue >= this.MIN_RED_THRESHOLD && rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableFrameCount = 0;
      this.lastStableValue = 0;
      return { isFingerDetected: false, quality: 0 };
    }

    if (this.lastValues.length < this.STABILITY_WINDOW) {
      return { isFingerDetected: false, quality: 0 };
    }

    const recentValues = this.lastValues.slice(-this.STABILITY_WINDOW);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    const variations = recentValues.map((val, i, arr) => {
      if (i === 0) return 0;
      return val - arr[i-1];
    });

    const maxVariation = Math.max(...variations.map(Math.abs));
    const minVariation = Math.min(...variations);
    
    const adaptiveThreshold = Math.max(1.5, avgValue * 0.02);
    const isStable = maxVariation < adaptiveThreshold * 2 && 
                    minVariation > -adaptiveThreshold * 2;

    if (isStable) {
      this.stableFrameCount = Math.min(this.stableFrameCount + 1, this.MIN_STABILITY_COUNT * 2);
      this.lastStableValue = filtered;
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }

    const periodicityScore = this.analyzeSignalPeriodicity();
    
    const stabilityScore = this.calculateSignalStabilityScore();
    
    const isBaselineStable = this.baselineHistory.length >= 5 && 
                            Date.now() - this.lastBaselineUpdate > 300;
    
    const isFingerDetected = this.stableFrameCount >= this.MIN_STABILITY_COUNT && 
                            periodicityScore > this.MIN_PERIODICITY_SCORE &&
                            stabilityScore > this.STABILITY_THRESHOLD &&
                            isBaselineStable;
    
    let quality = 0;
    if (isFingerDetected) {
      const stabilityFactor = Math.min(this.stableFrameCount / (this.MIN_STABILITY_COUNT * 2), 1);
      const intensityScore = Math.min((rawValue - this.MIN_RED_THRESHOLD) / 
                                    (this.MAX_RED_THRESHOLD - this.MIN_RED_THRESHOLD), 1);
      const variationScore = Math.max(0, 1 - (maxVariation / (adaptiveThreshold * 3)));
      
      quality = Math.round((stabilityFactor * 0.25 + 
                          intensityScore * 0.20 + 
                          variationScore * 0.15 + 
                          periodicityScore * 0.20 +
                          stabilityScore * 0.20) * 100);
    }

    return { isFingerDetected, quality };
  }

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
