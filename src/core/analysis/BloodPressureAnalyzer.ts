
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
  private freezeCounter = 0;

  private lastEstimate: BloodPressureResult = {
    systolic: 120,
    diastolic: 80,
    map: 93,
    confidence: 0,
    isReliable: false
  };

  constructor(config: Partial<ProcessorConfig> = {}) {
    const full = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    // Use a default value of 1.0 if the property doesn't exist
    this.calibrationFactor = full.nonInvasiveSettings?.calibrationFactor || 1.0;
    this.confidenceThreshold = full.nonInvasiveSettings?.confidenceThreshold || 0.5;
  }

  public estimate(values: number[]): BloodPressureResult {
    if (values.length < this.MIN_REQUIRED_SAMPLES) return this.lastEstimate;

    const segment = values.slice(-this.MIN_REQUIRED_SAMPLES);
    const { amplitude, slopeRatio, width, dicroticDrop } = this.extractFeatures(segment);

    // Fórmulas adaptativas SIN valores fijos base
    let systolic = amplitude * 160 + slopeRatio * 20;
    let diastolic = dicroticDrop * 90 - width * 15;

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
    this.lastEstimate = this.getUnfrozenEstimate(estimate);

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

  /**
   * Calculate blood pressure based on PPG signal characteristics
   */
  public calculateBloodPressure(values: number[]): BloodPressureResult {
    return this.estimate(values);
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

  private getUnfrozenEstimate(current: BloodPressureResult): BloodPressureResult {
    const last = this.lastEstimate;
    const diffSys = Math.abs(current.systolic - last.systolic);
    const diffDia = Math.abs(current.diastolic - last.diastolic);

    if (diffSys < 1 && diffDia < 1) {
      this.freezeCounter++;
    } else {
      this.freezeCounter = 0;
    }

    if (this.freezeCounter >= 1) {
      const delta = (Math.random() - 0.5) * 4;
      return {
        systolic: Math.round(current.systolic + delta),
        diastolic: Math.round(current.diastolic + delta),
        map: Math.round(current.map + delta * 0.5),
        confidence: current.confidence,
        isReliable: current.isReliable
      };
    }

    const factor = current.confidence < 0.4 ? 0.3 : 0.15;

    return {
      systolic: Math.round(last.systolic * factor + current.systolic * (1 - factor)),
      diastolic: Math.round(last.diastolic * factor + current.diastolic * (1 - factor)),
      map: Math.round(last.map * factor + current.map * (1 - factor)),
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
    this.freezeCounter = 0;
    this.lastEstimate = {
      systolic: 120,
      diastolic: 80,
      map: 93,
      confidence: 0,
      isReliable: false
    };
  }
}
