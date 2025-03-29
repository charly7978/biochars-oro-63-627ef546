import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';

export class GlucoseEstimator {
  private readonly MIN_GLUCOSE = 70;
  private readonly MAX_GLUCOSE = 170;
  private readonly DEFAULT_GLUCOSE = 95;

  private readonly AMPLITUDE_WEIGHT = 0.25;
  private readonly RISE_TIME_WEIGHT = 0.20;
  private readonly DECAY_WEIGHT = 0.20;
  private readonly WIDTH_WEIGHT = 0.15;
  private readonly SKEWNESS_WEIGHT = 0.20;

  private calibrationFactor: number;
  private confidenceThreshold: number;
  private history: number[] = [];
  private readonly HISTORY_SIZE = 5;
  private readonly STABILITY_FACTOR = 0.6;

  private lastEstimate: number = this.DEFAULT_GLUCOSE;
  private lastConfidence: number = 0;

  constructor(config: Partial<ProcessorConfig> = {}) {
    const full = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    this.calibrationFactor = full.nonInvasiveSettings.glucoseCalibrationFactor;
    this.confidenceThreshold = full.nonInvasiveSettings.confidenceThreshold;
    this.history = Array(this.HISTORY_SIZE).fill(this.DEFAULT_GLUCOSE);
  }

  public estimate(values: number[]): number {
    if (values.length < 150) return this.lastEstimate;

    const segment = values.slice(-150);
    const features = this.extractFeatures(segment);

    let estimate = this.DEFAULT_GLUCOSE;
    estimate += features.amplitude * 40 * this.AMPLITUDE_WEIGHT;
    estimate += features.riseTime * 20 * this.RISE_TIME_WEIGHT;
    estimate += features.decayRate * -15 * this.DECAY_WEIGHT;
    estimate += features.peakWidth * -10 * this.WIDTH_WEIGHT;
    estimate += features.skewness * 25 * this.SKEWNESS_WEIGHT;

    estimate *= this.calibrationFactor;
    estimate = Math.max(this.MIN_GLUCOSE, Math.min(this.MAX_GLUCOSE, estimate));

    this.history.push(estimate);
    if (this.history.length > this.HISTORY_SIZE) this.history.shift();

    const smoothed = this.getSmoothedEstimate();
    this.lastEstimate = parseFloat(smoothed.toFixed(1));
    this.lastConfidence = this.calculateConfidence(features);
    return this.lastEstimate;
  }

  private extractFeatures(data: number[]) {
    const peak = Math.max(...data);
    const valley = Math.min(...data);
    const amplitude = peak - valley;
    const riseTime = data.findIndex(v => v === peak);
    const decayRate = (peak - valley) / (data.length - riseTime);
    const peakWidth = data.filter(v => v > valley + amplitude * 0.6).length;
    const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
    const skewness = data.reduce((sum, val) => sum + Math.pow((val - mean), 3), 0) / data.length;

    return { amplitude, riseTime, decayRate, peakWidth, skewness };
  }

  private getSmoothedEstimate(): number {
    const weighted = this.history.slice(-this.HISTORY_SIZE);
    const stablePart = weighted.slice(0, -1).reduce((a, b) => a + b, 0) / (this.HISTORY_SIZE - 1);
    const recent = weighted[weighted.length - 1];
    return stablePart * this.STABILITY_FACTOR + recent * (1 - this.STABILITY_FACTOR);
  }

  private calculateConfidence(f: any): number {
    const score = (f.amplitude > 0.02 ? 1 : 0.5) *
                  (f.skewness > 0.01 ? 1 : 0.6) *
                  (f.peakWidth > 10 ? 1 : 0.8);
    return Math.min(1, score);
  }

  public getConfidence(): number {
    return this.lastConfidence;
  }

  public isReliable(): boolean {
    return this.lastConfidence >= this.confidenceThreshold;
  }

  public reset(): void {
    this.lastEstimate = this.DEFAULT_GLUCOSE;
    this.lastConfidence = 0;
    this.history = Array(this.HISTORY_SIZE).fill(this.DEFAULT_GLUCOSE);
  }
}
