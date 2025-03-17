import { ProcessedSignal, ProcessingError, SignalProcessor } from '../types/signal';
import { SignalAmplifier } from './SignalAmplifier';

class KalmanFilter {
  private R = 0.008; // Noise reduction factor
  private Q = 0.12;  // Process noise
  private P = 1;
  private X = 0;
  private K = 0;

  filter(measurement) {
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

export class PPGSignalProcessor {
  private readonly ROI_SIZE = 50;
  private readonly HISTORY_SIZE = 25;
  private readonly BASELINE_SIZE = 150;
  private readonly CALIBRATION_TIME = 5000;
  private readonly DEFAULT_CONFIG = {
    minSignal: 20,
    maxSignal: 150,
    noiseThreshold: 10,
    fuzziness: 0.1,
    calibrationSamples: 100,
    calibrationTimeout: 10000,
    fingerDetectionThreshold: 50,
    fingerLostThreshold: 20,
    minPerfusionIndex: 0.5,
    maxPerfusionIndex: 5,
    minSignalQuality: 30,
    maxSignalQuality: 95
  };

  private roiX: number = 0;
  private roiY: number = 0;
  private lastValues: number[] = [];
  private baselineValues: number[] = [];
  private hasEstablishedBaseline: boolean = false;
  private lastAmplifiedValue: number = 0;
  private signalQuality: number = 0;
  private isProcessing: boolean = false;
  private kalmanFilter: KalmanFilter;
  private signalAmplifier: SignalAmplifier;
  private currentConfig: any;
  private calibrationStartTime: number = 0;
  private calibrationSamplesCollected: number = 0;
  private calibrationTimeoutId: any;
  private fingerDetected: boolean = false;
  private lastFingerValue: number = 0;
  private lastFingerTimestamp: number = 0;
  private perfusionIndex: number = 0;
  private lastSignalTimestamp: number = 0;
  private lastSignalValue: number = 0;
  private lastSignalRoi: any = null;
  private lastError: any = null;

  public onSignalReady: ((signal: ProcessedSignal) => void) | undefined;
  public onError: ((error: ProcessingError) => void) | undefined;

  constructor(
    onSignalReady,
    onError
  ) {
    this.onSignalReady = onSignalReady;
    this.onError = onError;
    this.kalmanFilter = new KalmanFilter();
    this.currentConfig = { ...this.DEFAULT_CONFIG };
    this.signalAmplifier = new SignalAmplifier();
    this.isProcessing = false;
    this.lastValues = [];
    this.baselineValues = [];
    this.hasEstablishedBaseline = false;
    this.lastAmplifiedValue = 0;
    this.signalQuality = 0;
    console.log("PPGSignalProcessor: Instancia creada");
  }

  async initialize(): Promise<void> {
    console.log("PPGSignalProcessor: Inicializando");
    this.reset();
  }

  start(): void {
    console.log("PPGSignalProcessor: Iniciando");
    this.isProcessing = true;
    this.reset();
    this.signalAmplifier.reset();
  }

  stop(): void {
    console.log("PPGSignalProcessor: Deteniendo");
    this.isProcessing = false;
    this.reset();
    this.signalAmplifier.reset();
  }

  reset(): void {
    console.log("PPGSignalProcessor: Reseteando");
    this.lastValues = [];
    this.baselineValues = [];
    this.hasEstablishedBaseline = false;
    this.lastAmplifiedValue = 0;
    this.signalQuality = 0;
    this.kalmanFilter.reset();
    this.fingerDetected = false;
    this.lastFingerValue = 0;
    this.lastFingerTimestamp = 0;
    this.perfusionIndex = 0;
    this.lastSignalTimestamp = 0;
    this.lastSignalValue = 0;
    this.lastSignalRoi = null;
    this.lastError = null;
    clearTimeout(this.calibrationTimeoutId);
    this.calibrationSamplesCollected = 0;
  }

  async calibrate(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log("PPGSignalProcessor: Iniciando calibración");
      this.reset();
      this.calibrationStartTime = Date.now();
      this.calibrationSamplesCollected = 0;

      this.calibrationTimeoutId = setTimeout(() => {
        console.warn("PPGSignalProcessor: Calibración timed out");
        this.reset();
        reject(new Error("Calibration timed out"));
      }, this.CALIBRATION_TIME);

      const checkCalibrationStatus = () => {
        if (this.calibrationSamplesCollected >= this.currentConfig.calibrationSamples) {
          console.log("PPGSignalProcessor: Calibración completada");
          clearTimeout(this.calibrationTimeoutId);
          this.hasEstablishedBaseline = true;
          resolve();
        } else {
          console.log(`PPGSignalProcessor: Calibración en progreso (${this.calibrationSamplesCollected}/${this.currentConfig.calibrationSamples})`);
        }
      };

      checkCalibrationStatus();
    });
  }

  processFrame(imageData: ImageData): void {
    if (!this.isProcessing) {
      return;
    }

    const now = Date.now();
    const { data, width, height } = imageData;

    // 1. Detectar ROI (Region of Interest)
    const { x, y, avgColor } = this.detectROI(data, width, height);
    this.roiX = x;
    this.roiY = y;

    // 2. Detección de dedo
    const fingerValue = avgColor;
    const fingerThreshold = this.currentConfig.fingerDetectionThreshold;
    const fingerLostThreshold = this.currentConfig.fingerLostThreshold;
    const fingerTimeout = 1000;

    if (fingerValue >= fingerThreshold && (now - this.lastFingerTimestamp > fingerTimeout || !this.fingerDetected)) {
      this.fingerDetected = true;
      this.lastFingerValue = fingerValue;
      this.lastFingerTimestamp = now;
      console.log("PPGSignalProcessor: Dedo detectado", { fingerValue, fingerThreshold });
    } else if (fingerValue < fingerLostThreshold) {
      this.fingerDetected = false;
      console.warn("PPGSignalProcessor: Dedo perdido", { fingerValue, fingerLostThreshold });
    }

    // 3. Procesar señal solo si el dedo está detectado
    if (this.fingerDetected) {
      // 4. Filtrar y amplificar señal
      const filteredValue = this.kalmanFilter.filter(avgColor);
      const { amplifiedValue, quality } = this.signalAmplifier.processValue(filteredValue);
      this.lastAmplifiedValue = amplifiedValue;
      this.signalQuality = quality * 100;

      // 5. Actualizar historial de valores
      this.lastValues.push(amplifiedValue);
      if (this.lastValues.length > this.HISTORY_SIZE) {
        this.lastValues.shift();
      }

      // 6. Actualizar línea base durante la calibración
      if (!this.hasEstablishedBaseline) {
        this.baselineValues.push(amplifiedValue);
        this.calibrationSamplesCollected++;
        if (this.baselineValues.length > this.BASELINE_SIZE) {
          this.baselineValues.shift();
        }
      }

      // 7. Calcular Perfusion Index (PI)
      const PI = this.calculatePerfusionIndex();
      this.perfusionIndex = PI;

      // 8. Validar señal
      const isValidSignal = this.validateSignal(amplifiedValue, PI);

      if (isValidSignal) {
        const signal: ProcessedSignal = {
          timestamp: now,
          rawValue: avgColor,
          filteredValue: amplifiedValue,
          quality: this.signalQuality,
          roi: {
            x: this.roiX,
            y: this.roiY,
            width: this.ROI_SIZE,
            height: this.ROI_SIZE
          },
          perfusionIndex: this.perfusionIndex
        };

        this.lastSignalTimestamp = now;
        this.lastSignalValue = amplifiedValue;
        this.lastSignalRoi = signal.roi;

        if (this.onSignalReady) {
          this.onSignalReady(signal);
        }
      } else {
        const error: ProcessingError = {
          code: "INVALID_SIGNAL",
          message: "Señal inválida detectada",
          timestamp: now
        };

        this.lastError = error;

        if (this.onError) {
          this.onError(error);
        }
      }
    }
  }

  private detectROI(data: Uint8ClampedArray, width: number, height: number): { x: number, y: number, avgColor: number } {
    let x = Math.floor(width / 2 - this.ROI_SIZE / 2);
    let y = Math.floor(height / 2 - this.ROI_SIZE / 2);

    let total = 0;
    for (let i = 0; i < this.ROI_SIZE; i++) {
      for (let j = 0; j < this.ROI_SIZE; j++) {
        const pixelIndex = ((y + j) * width + (x + i)) * 4;
        const red = data[pixelIndex];
        const green = data[pixelIndex + 1];
        const blue = data[pixelIndex + 2];

        // Use only the red channel for simplicity
        total += red;
      }
    }

    const avgColor = total / (this.ROI_SIZE * this.ROI_SIZE);
    return { x, y, avgColor };
  }

  private calculatePerfusionIndex(): number {
    if (this.baselineValues.length === 0 || this.lastValues.length === 0) {
      return 0;
    }

    const baselineAvg = this.baselineValues.reduce((sum, val) => sum + val, 0) / this.baselineValues.length;
    const signalMax = Math.max(...this.lastValues);
    const signalMin = Math.min(...this.lastValues);

    const AC = signalMax - signalMin;
    const DC = baselineAvg;

    const PI = DC !== 0 ? AC / DC : 0;
    return PI;
  }

  private validateSignal(amplifiedValue: number, PI: number): boolean {
    if (!this.fingerDetected) {
      return false;
    }

    if (!this.hasEstablishedBaseline && this.calibrationSamplesCollected < this.currentConfig.calibrationSamples) {
      return false;
    }

    if (amplifiedValue < this.currentConfig.minSignal || amplifiedValue > this.currentConfig.maxSignal) {
      console.warn("PPGSignalProcessor: Señal fuera de rango", { amplifiedValue, minSignal: this.currentConfig.minSignal, maxSignal: this.currentConfig.maxSignal });
      return false;
    }

    if (this.signalQuality < this.currentConfig.minSignalQuality) {
      console.warn("PPGSignalProcessor: Baja calidad de señal", { signalQuality: this.signalQuality, minSignalQuality: this.currentConfig.minSignalQuality });
      return false;
    }

    if (PI < this.currentConfig.minPerfusionIndex || PI > this.currentConfig.maxPerfusionIndex) {
      console.warn("PPGSignalProcessor: Perfusion Index fuera de rango", { PI, minPerfusionIndex: this.currentConfig.minPerfusionIndex, maxPerfusionIndex: this.currentConfig.maxPerfusionIndex });
      return false;
    }

    return true;
  }
}
