import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';

export class HemoglobinEstimator {
  private readonly MIN_REQUIRED_SAMPLES = 80;
  private readonly DEFAULT_HEMOGLOBIN = 14.5;
  private readonly HISTORY_SIZE = 5;

  private calibrationFactor: number;
  private confidenceThreshold: number;
  private history: number[] = [];
  private lastEstimate: number = this.DEFAULT_HEMOGLOBIN;
  private lastConfidence: number = 0;

  constructor(config: Partial<ProcessorConfig> = {}) {
    const full = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    this.calibrationFactor = full.nonInvasiveSettings.hemoglobinCalibrationFactor || 1.0;
    this.confidenceThreshold = full.nonInvasiveSettings.confidenceThreshold || 0.6;
    this.history = Array(this.HISTORY_SIZE).fill(this.DEFAULT_HEMOGLOBIN);
  }

  public estimate(values: number[]): number {
    if (values.length < this.MIN_REQUIRED_SAMPLES) return this.lastEstimate;

    const segment = values.slice(-this.MIN_REQUIRED_SAMPLES);
    const { amplitude, skewness, flatness } = this.extractFeatures(segment);

    let estimate = this.DEFAULT_HEMOGLOBIN + amplitude * 15 + skewness * 8 - flatness * 12;
    estimate *= this.calibrationFactor;
    estimate = Math.max(10, Math.min(19, estimate));

    this.history.push(estimate);
    if (this.history.length > this.HISTORY_SIZE) this.history.shift();

    const smoothed = this.getSmoothedEstimate();
    this.lastEstimate = parseFloat(smoothed.toFixed(1));
    this.lastConfidence = this.calculateConfidence(amplitude, skewness, flatness);
    return this.lastEstimate;
  }

  private extractFeatures(data: number[]) {
    const peak = Math.max(...data);
    const valley = Math.min(...data);
    const amplitude = peak - valley;
    const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
    const skewness = data.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0) / data.length;
    const flatness = data.filter(v => Math.abs(v - mean) < 0.01).length / data.length;
    return { amplitude, skewness, flatness };
  }

  private getSmoothedEstimate(): number {
    const weights = this.history.map((val, i) => 1 + i);
    const weightedSum = this.history.reduce((sum, val, i) => sum + val * weights[i], 0);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    return weightedSum / totalWeight;
  }

  private calculateConfidence(a: number, s: number, f: number): number {
    const score = (a > 0.015 ? 1 : 0.6) * (Math.abs(s) > 0.005 ? 1 : 0.7) * (f < 0.2 ? 1 : 0.6);
    return Math.min(1, score);
  }

  public getConfidence(): number {
    return this.lastConfidence;
  }

  public isReliable(): boolean {
    return this.lastConfidence >= this.confidenceThreshold;
  }

  public reset(): void {
    this.history = Array(this.HISTORY_SIZE).fill(this.DEFAULT_HEMOGLOBIN);
    this.lastEstimate = this.DEFAULT_HEMOGLOBIN;
    this.lastConfidence = 0;
  }
}
