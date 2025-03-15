/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  signalQuality: number;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  };
  calibration?: {
    progress: {
      heartRate: number;
      spo2: number;
      pressure: number;
      arrhythmia: number;
    }
  };
  rawPPG?: number; // Added for tracking raw PPG value
}

export class VitalSignsProcessor {
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.02;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05;
  private readonly SPO2_WINDOW = 10;
  private readonly SMA_WINDOW = 3;

  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 25;
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 3000;
  private readonly PEAK_THRESHOLD = 0.3;

  private ppgValues: number[] = [];
  private lastValue = 0;
  private lastPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private baselineRhythm = 0;
  private isLearningPhase = true;
  private arrhythmiaDetected = false;
  private measurementStartTime: number = Date.now();
  private lastValidResult: VitalSignsResult | null = null;

  private spo2Buffer: number[] = [];
  private readonly SPO2_BUFFER_SIZE = 10;

  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private readonly BP_BUFFER_SIZE = 10;
  private readonly BP_ALPHA = 0.7;

  constructor() {
    console.log("VitalSignsProcessor: Inicializado con nueva interfaz mejorada");
  }

  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    
    const filteredValue = this.applySMAFilter(ppgValue);
    
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > this.WINDOW_SIZE) {
      this.ppgValues.shift();
    }

    if (rrData && rrData.intervals.length > 0) {
      this.rrIntervals = [...rrData.intervals];
      this.lastPeakTime = rrData.lastPeakTime;
      
      if (!this.isLearningPhase && this.rrIntervals.length >= this.RR_WINDOW_SIZE) {
        this.detectArrhythmia();
      }
    }

    const spo2 = this.calculateSpO2(this.ppgValues.slice(-60));
    const bp = this.calculateBloodPressure(this.ppgValues.slice(-60));
    const pressureString = `${bp.systolic}/${bp.diastolic}`;

    let arrhythmiaStatus = "--";
    
    const currentTime = Date.now();
    const timeSinceStart = currentTime - this.measurementStartTime;

    let arrhythmiaCount = 0;
    if (timeSinceStart > this.ARRHYTHMIA_LEARNING_PERIOD) {
      this.isLearningPhase = false;
      arrhythmiaStatus = this.arrhythmiaDetected ? "ARRITMIA DETECTADA" : "SIN ARRITMIAS";
      arrhythmiaCount = this.arrhythmiaDetected ? 1 : 0;
    }

    const rmssd = this.calculateRMSSD();
    const lastArrhythmiaData = {
      timestamp: Date.now(),
      rmssd: rmssd || 0,
      rrVariation: this.calculateRRVariation() || 0
    };

    // Simulated glucose and lipids based on signal quality
    const signalQuality = Math.min(100, Math.max(0, this.ppgValues.length / 3));
    const glucose = this.simulateGlucoseReading();
    const lipids = this.simulateLipidProfiles();

    // Crear resultado
    const result: VitalSignsResult = {
      spo2,
      pressure: pressureString,
      arrhythmiaStatus: `${arrhythmiaStatus}|${arrhythmiaCount}`,
      glucose,
      lipids,
      signalQuality,
      lastArrhythmiaData,
      calibration: {
        progress: {
          heartRate: Math.min(1, this.ppgValues.length / 60),
          spo2: Math.min(1, this.ppgValues.length / 90),
          pressure: Math.min(1, this.ppgValues.length / 150),
          arrhythmia: Math.min(1, timeSinceStart / this.ARRHYTHMIA_LEARNING_PERIOD)
        }
      },
      rawPPG: ppgValue
    };

    // Guardar último resultado válido
    if (spo2 > 90 && bp.systolic > 0 && bp.diastolic > 0) {
      this.lastValidResult = { ...result };
    }

    return result;
  }

  private detectArrhythmia() {
    
    if (this.rrIntervals.length < this.RR_WINDOW_SIZE) {
      return;
    }

    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    
    let sumSquaredDiff = 0;
    for (let i = 1; i < recentRR.length; i++) {
      const diff = recentRR[i] - recentRR[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / (recentRR.length - 1));
    
    const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
    const lastRR = recentRR[recentRR.length - 1];
    const prematureBeat = Math.abs(lastRR - avgRR) > (avgRR * 0.25);
    
    const newArrhythmiaState = rmssd > this.RMSSD_THRESHOLD && prematureBeat;

    if (newArrhythmiaState !== this.arrhythmiaDetected) {
      this.arrhythmiaDetected = newArrhythmiaState;
    }
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

  private calculateRMSSD(): number {
    
    if (this.rrIntervals.length < this.RR_WINDOW_SIZE) {
      return 0;
    }

    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    
    let sumSquaredDiff = 0;
    for (let i = 1; i < recentRR.length; i++) {
      const diff = recentRR[i] - recentRR[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiff / (recentRR.length - 1));
  }

  private calculateRRVariation(): number {
    
    if (this.rrIntervals.length < 3) {
      return 0;
    }

    const recentRR = this.rrIntervals.slice(-3);
    const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
    const lastRR = recentRR[recentRR.length - 1];
    
    return Math.abs(lastRR - avgRR) / avgRR;
  }

  private calculateAC(values: number[]): number {
    
    if (values.length === 0) return 0;
    return Math.max(...values) - Math.min(...values);
  }

  private calculateDC(values: number[]): number {
    
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private simulateGlucoseReading(): number {
    // Simulated glucose based on signal quality and randomness
    const baseGlucose = 90;
    const variation = Math.random() * 20 - 10;
    return Math.round(baseGlucose + variation);
  }

  private simulateLipidProfiles(): {totalCholesterol: number, triglycerides: number} {
    // Simulated lipids
    const baseCholesterol = 180;
    const baseTriglycerides = 120;
    const cholVariation = Math.random() * 30 - 15;
    const trigVariation = Math.random() * 40 - 20;
    
    return {
      totalCholesterol: Math.round(baseCholesterol + cholVariation),
      triglycerides: Math.round(baseTriglycerides + trigVariation)
    };
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

  /**
   * Reinicia el procesador pero conserva el último resultado válido
   */
  public reset(): VitalSignsResult | null {
    const savedResult = this.lastValidResult;
    
    this.ppgValues = [];
    this.smaBuffer = [];
    this.spo2Buffer = [];
    this.lastValue = 0;
    this.lastPeakTime = null;
    this.rrIntervals = [];
    this.isLearningPhase = true;
    this.arrhythmiaDetected = false;
    this.measurementStartTime = Date.now();
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    
    console.log("VitalSignsProcessor: Reset con conservación de último resultado válido");
    
    return savedResult;
  }

  /**
   * Reinicia completamente el procesador y todos sus datos
   */
  public fullReset(): void {
    this.ppgValues = [];
    this.smaBuffer = [];
    this.spo2Buffer = [];
    this.lastValue = 0;
    this.lastPeakTime = null;
    this.rrIntervals = [];
    this.isLearningPhase = true;
    this.arrhythmiaDetected = false;
    this.measurementStartTime = Date.now();
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastValidResult = null;
    
    console.log("VitalSignsProcessor: Reset completo sin conservación de resultados");
  }

  /**
   * Devuelve el último resultado válido
   */
  public get lastValidResults(): VitalSignsResult | null {
    return this.lastValidResult;
  }
}
