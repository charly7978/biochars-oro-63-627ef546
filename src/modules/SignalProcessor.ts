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
    MIN_RED_THRESHOLD: 85,
    MAX_RED_THRESHOLD: 255,
    STABILITY_WINDOW: 5,
    MIN_STABILITY_COUNT: 3,
    HYSTERESIS: 5
  };

  private currentConfig: typeof this.DEFAULT_CONFIG;
  private stableFrameCount: number = 0;
  private lastStableValue: number = 0;
  private isCurrentlyDetected: boolean = false;
  private lastDetectionTime: number = 0;
  private readonly DETECTION_TIMEOUT = 1000;
  private isAndroid: boolean = false;
  
  private redHistory: number[] = [];
  private greenHistory: number[] = [];
  private blueHistory: number[] = [];
  private filteredValueHistory: number[] = [];
  private readonly PHYSIO_HISTORY_SIZE = 20;
  private lastPulsePeakTime: number = 0;
  private lastRedGreenRatio: number = 0;
  private lastPulsatility: number = 0;
  
  private readonly MIN_PULSE_AMPLITUDE = 0.5;
  private readonly MAX_PULSE_AMPLITUDE = 4.0;
  private readonly MIN_RED_GREEN_RATIO = 1.08;
  private readonly MIN_PULSE_INTERVAL_MS = 250;
  private readonly MAX_PULSE_INTERVAL_MS = 1500;
  
  private lastDebugLog: number = 0;
  private readonly DEBUG_INTERVAL = 1000;

  constructor(
    public onSignalReady?: (signal: ProcessedSignal) => void,
    public onError?: (error: ProcessingError) => void
  ) {
    this.kalmanFilter = new KalmanFilter();
    this.isAndroid = /android/i.test(navigator.userAgent);
    
    if (this.isAndroid) {
      this.currentConfig = { 
        ...this.DEFAULT_CONFIG,
        MIN_RED_THRESHOLD: 80,
        BUFFER_SIZE: 10,
        STABILITY_WINDOW: 4
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
    console.log("PPGSignalProcessor: Detenido");
  }

  async calibrate(): Promise<boolean> {
    try {
      console.log("PPGSignalProcessor: Iniciando calibración");
      await this.initialize();
      
      if (this.isAndroid) {
        this.currentConfig = {
          ...this.DEFAULT_CONFIG,
          MIN_RED_THRESHOLD: 80
        };
      } else {
        this.currentConfig = {
          ...this.DEFAULT_CONFIG,
          MIN_RED_THRESHOLD: 90
        };
      }
      
      this.redHistory = [];
      this.greenHistory = [];
      this.blueHistory = [];
      this.filteredValueHistory = [];
      this.lastPulsePeakTime = 0;
      
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
      const extractionResult = this.extractImageFeatures(imageData);
      const redValue = extractionResult.redValue;
      const redGreenRatio = extractionResult.redGreenRatio;
      
      const now = Date.now();
      if (now - this.lastDebugLog > this.DEBUG_INTERVAL) {
        console.log("PPGSignalProcessor: Datos de extracción:", {
          redValue: redValue.toFixed(2),
          redGreenRatio: redGreenRatio.toFixed(2),
          brightness: extractionResult.brightness.toFixed(2),
          isRedDominant: extractionResult.isRedDominant,
          threshold: this.currentConfig.MIN_RED_THRESHOLD,
          isAndroid: this.isAndroid,
          time: new Date().toISOString()
        });
        this.lastDebugLog = now;
      }
      
      const filtered = this.kalmanFilter.filter(redValue);
      this.updatePhysiologicalFeatures(now, redValue, 
                                      extractionResult.greenValue,
                                      extractionResult.blueValue,
                                      filtered);
      
      const { isFingerDetected, quality } = this.analyzeSignalPhysiological(filtered, redValue, now);
      
      const pulsatility = this.calculatePulsatility();
      
      const processedSignal: ProcessedSignal = {
        timestamp: now,
        rawValue: redValue,
        filteredValue: filtered,
        quality: quality,
        fingerDetected: isFingerDetected,
        roi: this.detectROI(redValue),
        perfusionIndex: redValue > 0 ? 
          Math.abs(filtered - this.lastStableValue) / Math.max(1, redValue) : 0,
        redGreenRatio: redGreenRatio,
        pulsatility: pulsatility
      };
      
      if (this.onSignalReady) {
        this.onSignalReady(processedSignal);
      }
      
      if (isFingerDetected) {
        this.lastStableValue = filtered;
      }

    } catch (error) {
      console.error("PPGSignalProcessor: Error procesando frame", error);
      this.handleError("PROCESSING_ERROR", "Error al procesar frame");
    }
  }

  private extractImageFeatures(imageData: ImageData): { 
    redValue: number, 
    greenValue: number,
    blueValue: number,
    isRedDominant: boolean,
    redGreenRatio: number,
    brightness: number
  } {
    const data = imageData.data;
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let pixelCount = 0;
    
    const roiSize = this.isAndroid ? 
                    Math.min(imageData.width, imageData.height) * 0.5 :
                    Math.min(imageData.width, imageData.height) * 0.4;
    
    const centerX = Math.floor(imageData.width / 2);
    const centerY = Math.floor(imageData.height / 2);
    
    const startX = Math.max(0, Math.floor(centerX - roiSize / 2));
    const endX = Math.min(imageData.width, Math.floor(centerX + roiSize / 2));
    const startY = Math.max(0, Math.floor(centerY - roiSize / 2));
    const endY = Math.min(imageData.height, Math.floor(centerY + roiSize / 2));
    
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
    
    const avgRed = pixelCount > 0 ? redSum / pixelCount : 0;
    const avgGreen = pixelCount > 0 ? greenSum / pixelCount : 0;
    const avgBlue = pixelCount > 0 ? blueSum / pixelCount : 0;
    
    const brightness = (avgRed + avgGreen + avgBlue) / 3;
    
    const redGreenRatio = avgGreen > 0 ? avgRed / avgGreen : 1;
    
    const redThreshold = this.isAndroid ? this.currentConfig.MIN_RED_THRESHOLD * 0.9 : this.currentConfig.MIN_RED_THRESHOLD;
    const isRedDominant = redGreenRatio > this.MIN_RED_GREEN_RATIO && 
                          avgRed > redThreshold;
    
    this.updateColorHistory(avgRed, avgGreen, avgBlue);
    
    return {
      redValue: isRedDominant ? avgRed : 0,
      greenValue: avgGreen,
      blueValue: avgBlue,
      isRedDominant,
      redGreenRatio,
      brightness
    };
  }

  private updateColorHistory(red: number, green: number, blue: number): void {
    this.redHistory.push(red);
    this.greenHistory.push(green);
    this.blueHistory.push(blue);
    
    if (this.redHistory.length > this.PHYSIO_HISTORY_SIZE) {
      this.redHistory.shift();
      this.greenHistory.shift();
      this.blueHistory.shift();
    }
  }

  private updatePhysiologicalFeatures(timestamp: number, red: number, green: number, blue: number, filtered: number): void {
    this.filteredValueHistory.push(filtered);
    if (this.filteredValueHistory.length > this.PHYSIO_HISTORY_SIZE) {
      this.filteredValueHistory.shift();
    }
    
    this.lastRedGreenRatio = green > 0 ? red / green : 1;
    
    if (this.filteredValueHistory.length >= 5) {
      this.detectPulsePeaks(timestamp, filtered);
    }
  }

  private detectPulsePeaks(timestamp: number, value: number): void {
    if (this.filteredValueHistory.length < 5) return;
    
    const windowSize = Math.min(5, Math.floor(this.filteredValueHistory.length / 2));
    const recentValues = this.filteredValueHistory.slice(-windowSize * 2);
    
    let isPeak = true;
    
    for (let i = recentValues.length - windowSize; i < recentValues.length - 1; i++) {
      if (value <= recentValues[i]) {
        isPeak = false;
        break;
      }
    }
    
    if (isPeak && this.lastPulsePeakTime > 0) {
      const interval = timestamp - this.lastPulsePeakTime;
      
      if (interval >= this.MIN_PULSE_INTERVAL_MS && interval <= this.MAX_PULSE_INTERVAL_MS) {
        const min = Math.min(...recentValues);
        const amplitude = value - min;
        
        if (amplitude >= this.MIN_PULSE_AMPLITUDE && amplitude <= this.MAX_PULSE_AMPLITUDE) {
          this.lastPulsatility = amplitude;
        }
      }
      
      this.lastPulsePeakTime = timestamp;
    }
  }

  private calculatePulsatility(): number {
    if (this.filteredValueHistory.length < 3) return 0;
    
    if (this.lastPulsatility > 0) {
      return this.lastPulsatility;
    }
    
    const recentValues = this.filteredValueHistory.slice(-10);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const peakToPeak = max - min;
    
    return Math.min(this.MAX_PULSE_AMPLITUDE, peakToPeak);
  }

  private analyzeSignalPhysiological(filtered: number, rawValue: number, timestamp: number): { 
    isFingerDetected: boolean, 
    quality: number 
  } {
    const currentTime = timestamp;
    
    if (rawValue <= 0) {
      this.stableFrameCount = 0;
      this.isCurrentlyDetected = false;
      return { isFingerDetected: false, quality: 0 };
    }
    
    this.lastValues.push(filtered);
    if (this.lastValues.length > this.currentConfig.BUFFER_SIZE) {
      this.lastValues.shift();
    }
    
    let physiologicalScore = this.evaluatePhysiologicalFeatures();
    
    const stability = this.calculateStability();
    const isStable = stability > (this.isAndroid ? 0.6 : 0.7);
    
    if (isStable) {
      this.stableFrameCount = Math.min(
        this.stableFrameCount + 1,
        this.currentConfig.MIN_STABILITY_COUNT * 2
      );
    } else {
      this.stableFrameCount = Math.max(0, this.stableFrameCount - 0.5);
    }
    
    const isStableNow = this.stableFrameCount >= this.currentConfig.MIN_STABILITY_COUNT;
    
    let newDetection = false;
    
    if (physiologicalScore > 60 && isStableNow) {
      newDetection = true;
      this.lastDetectionTime = currentTime;
    } else if (this.isCurrentlyDetected && 
              (currentTime - this.lastDetectionTime < this.DETECTION_TIMEOUT)) {
      newDetection = true;
    } else {
      newDetection = false;
    }
    
    this.isCurrentlyDetected = newDetection;
    
    let quality = 0;
    if (this.isCurrentlyDetected) {
      const stabilityScore = Math.min(1, this.stableFrameCount / (this.currentConfig.MIN_STABILITY_COUNT * 2));
      
      quality = Math.round((physiologicalScore * 0.7 + stabilityScore * 100 * 0.3));
    }
    
    return {
      isFingerDetected: this.isCurrentlyDetected,
      quality
    };
  }

  private evaluatePhysiologicalFeatures(): number {
    if (this.redHistory.length < 5 || this.filteredValueHistory.length < 5) {
      return 0;
    }
    
    const avgRedGreenRatio = this.redHistory.length > 0 && this.greenHistory.length > 0 ?
      this.redHistory.reduce((sum, val) => sum + val, 0) / this.redHistory.length /
      (this.greenHistory.reduce((sum, val) => sum + val, 0) / this.greenHistory.length) : 0;
    
    const rgRatioScore = avgRedGreenRatio >= this.MIN_RED_GREEN_RATIO ?
      100 * Math.min(1, avgRedGreenRatio / (this.MIN_RED_GREEN_RATIO * 1.5)) : 0;
    
    const pulsatility = this.calculatePulsatility();
    let pulsatilityScore = 0;
    
    if (pulsatility >= this.MIN_PULSE_AMPLITUDE && pulsatility <= this.MAX_PULSE_AMPLITUDE) {
      const optimalPulse = (this.MIN_PULSE_AMPLITUDE + this.MAX_PULSE_AMPLITUDE) / 2;
      const normalizedDistance = Math.abs(pulsatility - optimalPulse) / (this.MAX_PULSE_AMPLITUDE - this.MIN_PULSE_AMPLITUDE);
      pulsatilityScore = 100 * (1 - Math.min(1, normalizedDistance * 2));
    }
    
    const colorDistributionScore = this.evaluateColorDistribution();
    
    const temporalScore = this.evaluateTemporalStability();
    
    const physiologicalScore = (
      rgRatioScore * 0.35 +
      pulsatilityScore * 0.30 +
      colorDistributionScore * 0.20 +
      temporalScore * 0.15
    );
    
    console.log("PPGSignalProcessor: Características fisiológicas", {
      rgRatio: avgRedGreenRatio.toFixed(2),
      rgScore: rgRatioScore.toFixed(0),
      pulsatility: pulsatility.toFixed(2),
      pulsScore: pulsatilityScore.toFixed(0),
      colorScore: colorDistributionScore.toFixed(0),
      tempScore: temporalScore.toFixed(0),
      total: physiologicalScore.toFixed(0)
    });
    
    return physiologicalScore;
  }

  private evaluateColorDistribution(): number {
    if (this.redHistory.length < 3 || this.greenHistory.length < 3 || this.blueHistory.length < 3) {
      return 0;
    }
    
    const avgRed = this.redHistory.reduce((sum, val) => sum + val, 0) / this.redHistory.length;
    const avgGreen = this.greenHistory.reduce((sum, val) => sum + val, 0) / this.greenHistory.length;
    const avgBlue = this.blueHistory.reduce((sum, val) => sum + val, 0) / this.blueHistory.length;
    
    if (avgRed <= avgGreen || avgGreen <= avgBlue) {
      return 0;
    }
    
    const redGreenDiff = avgRed - avgGreen;
    const greenBlueDiff = avgGreen - avgBlue;
    
    const isNaturalRGDiff = redGreenDiff > 10 && redGreenDiff < 100;
    const isNaturalGBDiff = greenBlueDiff > 5 && greenBlueDiff < 50;
    
    if (!isNaturalRGDiff || !isNaturalGBDiff) {
      return 30;
    }
    
    const idealRGDiff = 40;
    const idealGBDiff = 20;
    
    const rgSimilarity = 1 - Math.min(1, Math.abs(redGreenDiff - idealRGDiff) / idealRGDiff);
    const gbSimilarity = 1 - Math.min(1, Math.abs(greenBlueDiff - idealGBDiff) / idealGBDiff);
    
    return 100 * ((rgSimilarity * 0.7) + (gbSimilarity * 0.3));
  }

  private evaluateTemporalStability(): number {
    if (this.redHistory.length < 5 || this.filteredValueHistory.length < 5) {
      return 0;
    }
    
    const rgRatios = [];
    for (let i = 0; i < Math.min(this.redHistory.length, this.greenHistory.length); i++) {
      if (this.greenHistory[i] > 0) {
        rgRatios.push(this.redHistory[i] / this.greenHistory[i]);
      }
    }
    
    if (rgRatios.length < 3) return 0;
    
    const avgRgRatio = rgRatios.reduce((sum, val) => sum + val, 0) / rgRatios.length;
    const rgVariations = rgRatios.map(ratio => Math.abs(ratio - avgRgRatio) / avgRgRatio);
    const avgRgVariation = rgVariations.reduce((sum, val) => sum + val, 0) / rgVariations.length;
    
    if (avgRgVariation < 0.01 || avgRgVariation > 0.3) {
      return 30;
    }
    
    const optimalVariation = 0.05;
    const stabilityScore = 100 * (1 - Math.min(1, Math.abs(avgRgVariation - optimalVariation) / 0.1));
    
    return stabilityScore;
  }

  private calculateStability(): number {
    if (this.lastValues.length < 3) return 0;
    
    const variations = [];
    for (let i = 1; i < this.lastValues.length; i++) {
      variations.push(Math.abs(this.lastValues[i] - this.lastValues[i-1]));
    }
    
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
    
    const threshold = this.isAndroid ? 8 : 5;
    const normalizedStability = Math.max(0, Math.min(1, 1 - (avgVariation / threshold)));
    
    return normalizedStability;
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
