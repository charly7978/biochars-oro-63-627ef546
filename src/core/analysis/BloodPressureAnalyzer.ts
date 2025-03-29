import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';

export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  map: number;
  confidence: number;
  isReliable: boolean;
}

export class BloodPressureAnalyzer {
  private readonly MIN_REQUIRED_SAMPLES = 60;
  private readonly history: BloodPressureResult[] = [];
  private readonly HISTORY_SIZE = 5;

  private calibrationFactor: number;
  private confidenceThreshold: number;

  private lastEstimate: BloodPressureResult = {
    systolic: 120,
    diastolic: 80,
    map: 93,
    confidence: 0,
    isReliable: false
  };

  constructor(config: Partial<ProcessorConfig> = {}) {
    const full = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    this.calibrationFactor = full.nonInvasiveSettings.bpCalibrationFactor || 1.0;
    this.confidenceThreshold = full.nonInvasiveSettings.confidenceThreshold || 0.5;
  }

  public estimate(values: number[]): BloodPressureResult {
    if (values.length < this.MIN_REQUIRED_SAMPLES) return this.lastEstimate;

    const segment = values.slice(-this.MIN_REQUIRED_SAMPLES);
    const { amplitude, slopeRatio, width, dicroticDrop } = this.extractFeatures(segment);

    let systolic = 110 + amplitude * 100 + slopeRatio * 15;
    let diastolic = 70 + dicroticDrop * 50 - width * 10;

    systolic *= this.calibrationFactor;
    diastolic *= this.calibrationFactor;

    const map = diastolic + (systolic - diastolic) / 3;

    let confidence = this.calculateConfidence(amplitude, slopeRatio, width, dicroticDrop);
    if (isNaN(confidence)) confidence = 0;

    const isReliable = confidence >= this.confidenceThreshold;

    const estimate: BloodPressureResult = {
      systolic: Math.round(this.bound(systolic, 90, 180)),
      diastolic: Math.round(this.bound(diastolic, 55, 120)),
      map: Math.round(map),
      confidence,
      isReliable
    };

    this.pushToHistory(estimate);
    this.lastEstimate = this.getForceSmoothedEstimate(estimate);

    console.log('[BP DEBUG]', {
      amplitude: amplitude.toFixed(4),
      slopeRatio: slopeRatio.toFixed(4),
      width,
      dicroticDrop: dicroticDrop.toFixed(4),
      confidence: confidence.toFixed(3),
      systolic: estimate.systolic,
      diastolic: estimate.diastolic
    });

    return this.lastEstimate;
  }

  private extractFeatures(data: number[]) {
    const peak = Math.max(...data);
    const valley = Math.min(...data);
    const amplitude = peak - valley;

    const riseIndex = data.findIndex(v => v === peak);
    const slopeRise = (peak - valley) / (riseIndex + 1);
    const slopeFall = (peak - valley) / (data.length - riseIndex);
    const slopeRatio = slopeRise / (slopeFall + 1e-5);

    const width = data.filter(v => v > valley + amplitude * 0.5).length;

    const dicroticDrop = (peak - data[data.length - 1]) / amplitude;

    return { amplitude, slopeRatio, width, dicroticDrop };
  }

  private calculateConfidence(a: number, s: number, w: number, d: number): number {
    const score = (a > 0.02 ? 1 : 0.6) * (s > 1 ? 1 : 0.8) * (w > 10 ? 1 : 0.8) * (d > 0.1 ? 1 : 0.7);
    return Math.min(1, score);
  }

  private bound(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private pushToHistory(val: BloodPressureResult) {
    this.history.push(val);
    if (this.history.length > this.HISTORY_SIZE) this.history.shift();
  }

  private getForceSmoothedEstimate(current: BloodPressureResult): BloodPressureResult {
    const factor = current.confidence < 0.4 ? 0.4 : 0.2; // más sensible
    const minimumChange = 1; // forzar al menos 1 punto de diferencia si confiable

    let systolic = this.lastEstimate.systolic * factor + current.systolic * (1 - factor);
    let diastolic = this.lastEstimate.diastolic * factor + current.diastolic * (1 - factor);
    let map = this.lastEstimate.map * factor + current.map * (1 - factor);

    // Forzar cambio mínimo si se queda congelado
    if (Math.abs(systolic - this.lastEstimate.systolic) < minimumChange) {
      systolic += Math.sign(current.systolic - this.lastEstimate.systolic) * minimumChange;
    }
    if (Math.abs(diastolic - this.lastEstimate.diastolic) < minimumChange) {
      diastolic += Math.sign(current.diastolic - this.lastEstimate.diastolic) * minimumChange;
    }

    return {
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      map: Math.round(map),
      confidence: current.confidence,
      isReliable: current.isReliable
    };
  }

  public getConfidence(): number {
    return this.lastEstimate.confidence;
  }

  public isReliable(): boolean {
    return this.lastEstimate.isReliable;
  }

  public reset(): void {
    this.history.length = 0;
    this.lastEstimate = {
      systolic: 120,
      diastolic: 80,
      map: 93,
      confidence: 0,
      isReliable: false
    };
  }
}
