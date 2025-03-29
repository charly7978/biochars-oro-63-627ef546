import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';

export interface LipidProfile {
  totalCholesterol: number;
  triglycerides: number;
  confidence: number;
}

export class LipidEstimator {
  private readonly DEFAULTS = {
    cholesterol: 170,
    triglycerides: 100,
    minCholesterol: 130,
    maxCholesterol: 240,
    minTriglycerides: 50,
    maxTriglycerides: 300
  };

  private readonly HISTORY_SIZE = 5;
  private readonly STABILITY_FACTOR = 0.6;

  private history: LipidProfile[] = [];
  private lastEstimate: LipidProfile = {
    totalCholesterol: 170,
    triglycerides: 100,
    confidence: 0
  };

  private cholesterolCalibrationFactor: number;
  private triglycerideCalibrationFactor: number;
  private confidenceThreshold: number;

  constructor(config: Partial<ProcessorConfig> = {}) {
    const full = { ...DEFAULT_PROCESSOR_CONFIG, ...config };
    this.cholesterolCalibrationFactor = full.nonInvasiveSettings.cholesterolCalibrationFactor || 1.0;
    this.triglycerideCalibrationFactor = full.nonInvasiveSettings.triglycerideCalibrationFactor || 1.0;
    this.confidenceThreshold = full.nonInvasiveSettings.confidenceThreshold || 0.7;
    this.history = Array(this.HISTORY_SIZE).fill(this.lastEstimate);
  }

  public estimate(values: number[]): LipidProfile {
    if (values.length < 120) return this.lastEstimate;

    const segment = values.slice(-120);
    const { absorptionRatio, peakComplexity, waveformWidth } = this.extractSpectralFeatures(segment);

    let cholesterol = this.DEFAULTS.cholesterol + absorptionRatio * 50 - waveformWidth * 10;
    let triglycerides = this.DEFAULTS.triglycerides + peakComplexity * 40;

    cholesterol *= this.cholesterolCalibrationFactor;
    triglycerides *= this.triglycerideCalibrationFactor;

    cholesterol = this.bound(cholesterol, this.DEFAULTS.minCholesterol, this.DEFAULTS.maxCholesterol);
    triglycerides = this.bound(triglycerides, this.DEFAULTS.minTriglycerides, this.DEFAULTS.maxTriglycerides);

    const confidence = this.calculateConfidence(absorptionRatio, peakComplexity, waveformWidth);
    const smoothed = this.getSmoothedEstimate({ totalCholesterol: cholesterol, triglycerides, confidence });
    this.lastEstimate = smoothed;
    return smoothed;
  }

  private extractSpectralFeatures(data: number[]) {
    const peak = Math.max(...data);
    const valley = Math.min(...data);
    const absorptionRatio = (peak - valley) / (peak + valley + 1e-5);
    const zeroCrossings = data.reduce((count, val, i, arr) => {
      if (i === 0) return count;
      return count + (Math.sign(val) !== Math.sign(arr[i - 1]) ? 1 : 0);
    }, 0);
    const peakComplexity = zeroCrossings / data.length;
    const waveformWidth = data.filter(v => v > valley + (peak - valley) * 0.5).length;

    return { absorptionRatio, peakComplexity, waveformWidth };
  }

  private calculateConfidence(a: number, p: number, w: number): number {
    const score = (a > 0.2 ? 1 : 0.6) * (p > 0.05 ? 1 : 0.7) * (w > 10 ? 1 : 0.8);
    return Math.min(1, score);
  }

  private getSmoothedEstimate(current: LipidProfile): LipidProfile {
    this.history.push(current);
    if (this.history.length > this.HISTORY_SIZE) this.history.shift();

    const avg = this.history.reduce((acc, val) => {
      acc.totalCholesterol += val.totalCholesterol;
      acc.triglycerides += val.triglycerides;
      acc.confidence += val.confidence;
      return acc;
    }, { totalCholesterol: 0, triglycerides: 0, confidence: 0 });

    const n = this.history.length;
    return {
      totalCholesterol: (avg.totalCholesterol / n) * this.STABILITY_FACTOR + current.totalCholesterol * (1 - this.STABILITY_FACTOR),
      triglycerides: (avg.triglycerides / n) * this.STABILITY_FACTOR + current.triglycerides * (1 - this.STABILITY_FACTOR),
      confidence: avg.confidence / n
    };
  }

  private bound(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  public getConfidence(): number {
    return this.lastEstimate.confidence;
  }

  public isReliable(): boolean {
    return this.lastEstimate.confidence >= this.confidenceThreshold;
  }

  public reset(): void {
    this.lastEstimate = {
      totalCholesterol: this.DEFAULTS.cholesterol,
      triglycerides: this.DEFAULTS.triglycerides,
      confidence: 0
    };
    this.history = Array(this.HISTORY_SIZE).fill(this.lastEstimate);
  }
}
