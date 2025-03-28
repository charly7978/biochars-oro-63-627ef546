import { ArrhythmiaDetector, ArrhythmiaDetectionResult } from './ArrhythmiaDetector';
import { calculateAC, calculateDC, calculatePerfusionIndex, applySMAFilter } from './utils';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  visualWindow?: {
    start: number;
    end: number;
  } | null;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  calibration?: {
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
    }
  };
  lipids?: {
    totalCholesterol: number;
    triglycerides: number;
  };
  glucose?: number;
}

export class VitalSignsProcessor {
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.05; // Aumentado de 1.02 a 1.05 para mejor calibración
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045; // Reducido de 0.05 a 0.045 para mayor sensibilidad
  private readonly SPO2_WINDOW = 8; // Reducido de 10 a 8 para respuesta más rápida
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 22; // Reducido de 25 a 22 para mejor detección de arritmias
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 2500; // Reducido de 3000 a 2500 ms
  private readonly PEAK_THRESHOLD = 0.28; // Reducido de 0.3 a 0.28 para mayor sensibilidad
  
  private ppgValues: number[] = [];
  private lastValue = 0;
  private lastPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private measurementStartTime: number = Date.now();
  private arrhythmiaDetector: ArrhythmiaDetector;
  
  private spo2Buffer: number[] = [];
  private readonly SPO2_BUFFER_SIZE = 10;

  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private readonly BP_BUFFER_SIZE = 10;
  private readonly BP_ALPHA = 0.7;
  
  constructor() {
    this.arrhythmiaDetector = new ArrhythmiaDetector();
    this.reset();
  }

  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    const filteredValue = this.applySMAFilter(ppgValue);
    
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }

    // Process RR data for arrhythmia detection
    let arrhythmiaResult: ArrhythmiaDetectionResult = {
      isArrhythmia: false,
      arrhythmiaCounter: 0,
      arrhythmiaStatus: "--",
      lastArrhythmiaData: null,
      visualWindow: null
    };
    
    const signalQuality = this.calculateSignalQuality(this.ppgValues.slice(-30));
    
    if (rrData && rrData.intervals.length > 0) {
      this.rrIntervals = [...rrData.intervals];
      this.lastPeakTime = rrData.lastPeakTime;
      
      const currentTime = Date.now();
      arrhythmiaResult = this.arrhythmiaDetector.analyzeRRIntervals(
        this.rrIntervals,
        currentTime,
        signalQuality
      );
    }

    const spo2 = this.calculateSpO2(this.ppgValues.slice(-60));
    const bp = this.calculateBloodPressure(this.ppgValues.slice(-60));
    const pressureString = `${bp.systolic}/${bp.diastolic}`;

    // Simulated values for demo purposes - these would normally come from real algorithms
    const glucose = this.estimateGlucose(spo2, bp, this.ppgValues.slice(-60));
    const lipids = this.estimateLipids(spo2, bp, this.ppgValues.slice(-60));

    const calibrationProgress = {
      heartRate: Math.min(1, this.ppgValues.length / 60),
      spo2: Math.min(1, this.spo2Buffer.length / this.SPO2_BUFFER_SIZE),
      pressure: Math.min(1, this.systolicBuffer.length / this.BP_BUFFER_SIZE),
      arrhythmia: Math.min(1, (Date.now() - this.measurementStartTime) / 5000)
    };

    return {
      spo2,
      pressure: pressureString,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      visualWindow: arrhythmiaResult.visualWindow,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      calibration: { progress: calibrationProgress },
      glucose,
      lipids
    };
  }

  private calculateSignalQuality(values: number[]): number {
    if (values.length < 10) return 0;
    
    const std = this.calculateStandardDeviation(values);
    const ac = this.calculateAC(values);
    const dc = this.calculateDC(values);
    
    const variability = std / (dc > 0 ? dc : 1);
    const perfusionIndex = ac / (dc > 0 ? dc : 1);
    
    // Higher score for moderate variability and good perfusion
    const score = (0.7 * Math.min(perfusionIndex * 100, 100)) + 
                  (0.3 * (100 - Math.abs(variability - 0.15) * 200));
    
    return Math.max(0, Math.min(100, score));
  }

  private estimateGlucose(spo2: number, bp: {systolic: number, diastolic: number}, values: number[]): number {
    // Simple simulation algorithm for demo purposes
    const baseGlucose = 95;
    
    // Adjust based on SpO2
    const spo2Factor = spo2 > 0 ? (spo2 - 90) * 0.5 : 0;
    
    // Adjust based on blood pressure
    const bpFactor = bp.systolic > 0 ? ((bp.systolic - 120) * 0.2) : 0;
    
    // Adjust based on signal variability
    const std = this.calculateStandardDeviation(values);
    const variabilityFactor = std * 10;
    
    const glucose = Math.round(baseGlucose + spo2Factor + bpFactor + variabilityFactor);
    return Math.max(70, Math.min(140, glucose));
  }
  
  private estimateLipids(spo2: number, bp: {systolic: number, diastolic: number}, values: number[]): {totalCholesterol: number, triglycerides: number} {
    // Simple simulation algorithm for demo purposes
    const baseCholesterol = 170;
    const baseTriglycerides = 120;
    
    // Adjust based on blood pressure
    const bpFactor = bp.systolic > 0 ? ((bp.systolic - 120) * 0.6) : 0;
    
    // Adjust based on signal characteristics
    const ac = this.calculateAC(values);
    const dc = this.calculateDC(values);
    const perfusionIndex = dc > 0 ? ac / dc : 0;
    const perfusionFactor = perfusionIndex * 50;
    
    const cholesterol = Math.round(baseCholesterol + bpFactor + perfusionFactor);
    const triglycerides = Math.round(baseTriglycerides + bpFactor * 0.7 + perfusionFactor * 0.8);
    
    return {
      totalCholesterol: Math.max(150, Math.min(250, cholesterol)),
      triglycerides: Math.max(80, Math.min(200, triglycerides))
    };
  }

  private calculateStandardDeviation(values: number[]): number {
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
    return Math.sqrt(avgSqDiff);
  }

  private calculateAC(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.max(...values) - Math.min(...values);
  }

  private calculateDC(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private smaBuffer: number[] = [];
  private applySMAFilter(value: number): number {
    this.smaBuffer.push(value);
    if (this.smaBuffer.length > this.SMA_WINDOW) {
      this.smaBuffer.shift();
    }
    const sum = this.smaBuffer.reduce((a, b) => a + b, 0);
    return sum / this.smaBuffer.length;
  }

  private calculateSpO2(values: number[]): number {
    if (values.length < 30) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 1);
      }
      return 0;
    }

    const dc = this.calculateDC(values);
    if (dc === 0) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 1);
      }
      return 0;
    }

    const ac = this.calculateAC(values);
    
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 2);
      }
      return 0;
    }

    const R = (ac / dc) / this.SPO2_CALIBRATION_FACTOR;
    
    let spO2 = Math.round(98 - (15 * R));
    
    if (perfusionIndex > 0.15) {
      spO2 = Math.min(98, spO2 + 1);
    } else if (perfusionIndex < 0.08) {
      spO2 = Math.max(0, spO2 - 1);
    }

    spO2 = Math.min(98, spO2);

    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    if (this.spo2Buffer.length > 0) {
      const sum = this.spo2Buffer.reduce((a, b) => a + b, 0);
      spO2 = Math.round(sum / this.spo2Buffer.length);
    }

    return spO2;
  }

  private calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    if (values.length < 30) {
      return { systolic: 0, diastolic: 0 };
    }

    const { peakIndices, valleyIndices } = this.localFindPeaksAndValleys(values);
    if (peakIndices.length < 2) {
      return { systolic: 120, diastolic: 80 };
    }

    const fps = 30;
    const msPerSample = 1000 / fps;

    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      pttValues.push(dt);
    }
    
    const weightedPTT = pttValues.reduce((acc, val, idx) => {
      const weight = (idx + 1) / pttValues.length;
      return acc + val * weight;
    }, 0) / pttValues.reduce((acc, _, idx) => acc + (idx + 1) / pttValues.length, 0);

    const normalizedPTT = Math.max(300, Math.min(1200, weightedPTT));
    const amplitude = this.calculateAmplitude(values, peakIndices, valleyIndices);
    const normalizedAmplitude = Math.min(100, Math.max(0, amplitude * 5));

    const pttFactor = (600 - normalizedPTT) * 0.08;
    const ampFactor = normalizedAmplitude * 0.3;
    
    let instantSystolic = 120 + pttFactor + ampFactor;
    let instantDiastolic = 80 + (pttFactor * 0.5) + (ampFactor * 0.2);

    instantSystolic = Math.max(90, Math.min(180, instantSystolic));
    instantDiastolic = Math.max(60, Math.min(110, instantDiastolic));
    
    const differential = instantSystolic - instantDiastolic;
    if (differential < 20) {
      instantDiastolic = instantSystolic - 20;
    } else if (differential > 80) {
      instantDiastolic = instantSystolic - 80;
    }

    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

    let finalSystolic = 0;
    let finalDiastolic = 0;
    let weightSum = 0;

    for (let i = 0; i < this.systolicBuffer.length; i++) {
      const weight = Math.pow(this.BP_ALPHA, this.systolicBuffer.length - 1 - i);
      finalSystolic += this.systolicBuffer[i] * weight;
      finalDiastolic += this.diastolicBuffer[i] * weight;
      weightSum += weight;
    }

    finalSystolic = finalSystolic / weightSum;
    finalDiastolic = finalDiastolic / weightSum;

    return {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic)
    };
  }

  private localFindPeaksAndValleys(values: number[]) {
    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];

    for (let i = 2; i < values.length - 2; i++) {
      const v = values[i];
      if (
        v > values[i - 1] &&
        v > values[i - 2] &&
        v > values[i + 1] &&
        v > values[i + 2]
      ) {
        peakIndices.push(i);
      }
      if (
        v < values[i - 1] &&
        v < values[i - 2] &&
        v < values[i + 1] &&
        v < values[i + 2]
      ) {
        valleyIndices.push(i);
      }
    }
    return { peakIndices, valleyIndices };
  }

  private calculateAmplitude(
    values: number[],
    peaks: number[],
    valleys: number[]
  ): number {
    if (peaks.length === 0 || valleys.length === 0) return 0;

    const amps: number[] = [];
    const len = Math.min(peaks.length, valleys.length);
    for (let i = 0; i < len; i++) {
      const amp = values[peaks[i]] - values[valleys[i]];
      if (amp > 0) {
        amps.push(amp);
      }
    }
    if (amps.length === 0) return 0;

    const mean = amps.reduce((a, b) => a + b, 0) / amps.length;
    return mean;
  }

  private calculateStandardDeviation(values: number[]): number {
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
    return Math.sqrt(avgSqDiff);
  }

  private calculateAC(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.max(...values) - Math.min(...values);
  }

  private calculateDC(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  public reset(): VitalSignsResult | null {
    const lastValidResult: VitalSignsResult | null = this.ppgValues.length > 30 ? {
      spo2: this.calculateSpO2(this.ppgValues.slice(-60)),
      pressure: (() => {
        const bp = this.calculateBloodPressure(this.ppgValues.slice(-60));
        return `${bp.systolic}/${bp.diastolic}`;
      })(),
      arrhythmiaStatus: this.arrhythmiaDetector.getArrhythmiaCounter() > 0 ? 
        `ARRITMIA DETECTADA|${this.arrhythmiaDetector.getArrhythmiaCounter()}` : 
        `SIN ARRITMIAS|0`,
      glucose: this.estimateGlucose(
        this.calculateSpO2(this.ppgValues.slice(-60)),
        this.calculateBloodPressure(this.ppgValues.slice(-60)),
        this.ppgValues.slice(-60)
      ),
      lipids: this.estimateLipids(
        this.calculateSpO2(this.ppgValues.slice(-60)),
        this.calculateBloodPressure(this.ppgValues.slice(-60)),
        this.ppgValues.slice(-60)
      )
    } : null;
    
    this.ppgValues = [];
    this.smaBuffer = [];
    this.spo2Buffer = [];
    this.lastValue = 0;
    this.lastPeakTime = null;
    this.rrIntervals = [];
    this.arrhythmiaDetector.reset();
    this.measurementStartTime = Date.now();
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    
    return lastValidResult;
  }
  
  public fullReset(): void {
    this.reset();
    this.arrhythmiaDetector = new ArrhythmiaDetector();
  }

  private smaBuffer: number[] = [];
}
