// SignalQualityDetector.ts
// Clase para detección robusta de dedo basada en patrones fisiológicos

export interface AdvancedDetectionConfig {
  weakSignalThreshold: number;
  maxConsecutiveWeakSignals: number;
  patternDetectionWindowMs: number;
  minPeaksForRhythm: number;
  peakDetectionThreshold: number;
  requiredConsistentPatterns: number;
  minSignalVariance: number;
  minHeartRateIntervalMs: number;
  maxHeartRateIntervalMs: number;
  maxRhythmDeviation: number;
  consistencyRequirement: number;
  fastRecoveryFactor: number;
  adaptiveThresholding: boolean;
  spectralAnalysisEnabled: boolean;
  useKalmanFiltering: boolean;
}

export class SignalQualityDetector {
  private config: AdvancedDetectionConfig;
  private consecutiveWeakSignals: number = 0;
  private signalHistory: Array<{time: number, value: number}> = [];
  private lastPeakTimes: number[] = [];
  private detectedRhythmicPatterns: number = 0;
  private fingerDetectionConfirmed: boolean = false;
  private adaptiveThreshold: number;

  constructor(config?: Partial<AdvancedDetectionConfig>) {
    this.config = {
      weakSignalThreshold: 0.15,
      maxConsecutiveWeakSignals: 4,
      patternDetectionWindowMs: 2500,
      minPeaksForRhythm: 3,
      peakDetectionThreshold: 0.15,
      requiredConsistentPatterns: 2,
      minSignalVariance: 0.02,
      minHeartRateIntervalMs: 300,
      maxHeartRateIntervalMs: 2000,
      maxRhythmDeviation: 200,
      consistencyRequirement: 0.6,
      fastRecoveryFactor: 2,
      adaptiveThresholding: true,
      spectralAnalysisEnabled: false,
      useKalmanFiltering: false,
      ...config
    };
    this.adaptiveThreshold = this.config.peakDetectionThreshold;
  }

  public updateConfig(newConfig: Partial<AdvancedDetectionConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public detectWeakSignal(value: number): boolean {
    const now = Date.now();
    this.signalHistory.push({ time: now, value });
    this.signalHistory = this.signalHistory.filter(
      point => now - point.time < this.config.patternDetectionWindowMs * 2
    );
    if (this.fingerDetectionConfirmed) {
      if (Math.abs(value) < this.config.weakSignalThreshold) {
        this.consecutiveWeakSignals++;
        if (this.consecutiveWeakSignals > this.config.maxConsecutiveWeakSignals * this.config.fastRecoveryFactor) {
          this.fingerDetectionConfirmed = false;
          this.detectedRhythmicPatterns = 0;
        }
      } else {
        this.consecutiveWeakSignals = Math.max(0, this.consecutiveWeakSignals - this.config.fastRecoveryFactor);
      }
      return this.consecutiveWeakSignals >= this.config.maxConsecutiveWeakSignals;
    } else {
      if (Math.abs(value) < this.config.weakSignalThreshold) {
        this.consecutiveWeakSignals++;
      } else {
        this.consecutiveWeakSignals = Math.max(0, this.consecutiveWeakSignals - this.config.fastRecoveryFactor);
      }
      const hasRhythmicPattern = this.detectPeaks();
      if (hasRhythmicPattern) {
        this.consecutiveWeakSignals = 0;
        return false;
      }
      return this.consecutiveWeakSignals >= this.config.maxConsecutiveWeakSignals;
    }
  }

  public isFingerDetected(): boolean {
    if (this.fingerDetectionConfirmed) {
      return this.consecutiveWeakSignals < this.config.maxConsecutiveWeakSignals * this.config.fastRecoveryFactor;
    }
    return this.detectedRhythmicPatterns >= this.config.requiredConsistentPatterns;
  }

  public reset(): void {
    this.consecutiveWeakSignals = 0;
    this.signalHistory = [];
    this.lastPeakTimes = [];
    this.detectedRhythmicPatterns = 0;
    this.fingerDetectionConfirmed = false;
  }

  private detectPeaks(): boolean {
    const now = Date.now();
    const recentSignals = this.signalHistory.filter(
      point => now - point.time < this.config.patternDetectionWindowMs
    );
    if (recentSignals.length < 10) return false;
    const values = recentSignals.map(s => s.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    if (variance < this.config.minSignalVariance) {
      this.detectedRhythmicPatterns = Math.max(0, this.detectedRhythmicPatterns - 1);
      return false;
    }
    const peaks: number[] = [];
    const threshold = this.config.adaptiveThresholding ? this.calculateAdaptiveThreshold(values) : this.config.peakDetectionThreshold;
    this.adaptiveThreshold = threshold;
    let rising = false;
    for (let i = 2; i < recentSignals.length - 2; i++) {
      const current = recentSignals[i];
      const prev = recentSignals[i - 1];
      const next = recentSignals[i + 1];
      if (!rising && current.value > prev.value) {
        rising = true;
      } else if (rising && current.value > next.value) {
        if (Math.abs(current.value) > threshold) {
          peaks.push(current.time);
          rising = false;
        }
      }
    }
    if (peaks.length >= this.config.minPeaksForRhythm) {
      const intervals: number[] = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i - 1]);
      }
      const validIntervals = intervals.filter(interval =>
        interval >= this.config.minHeartRateIntervalMs &&
        interval <= this.config.maxHeartRateIntervalMs
      );
      if (validIntervals.length < Math.floor(intervals.length * this.config.consistencyRequirement)) {
        this.detectedRhythmicPatterns = Math.max(0, this.detectedRhythmicPatterns - 1);
        return false;
      }
      let consistentIntervals = 0;
      for (let i = 1; i < validIntervals.length; i++) {
        if (Math.abs(validIntervals[i] - validIntervals[i - 1]) < this.config.maxRhythmDeviation) {
          consistentIntervals++;
        }
      }
      if (consistentIntervals >= this.config.minPeaksForRhythm - 1) {
        this.lastPeakTimes = peaks;
        this.detectedRhythmicPatterns++;
        if (this.detectedRhythmicPatterns >= this.config.requiredConsistentPatterns) {
          this.fingerDetectionConfirmed = true;
          return true;
        }
      } else {
        this.detectedRhythmicPatterns = Math.max(0, this.detectedRhythmicPatterns - 1);
      }
    } else {
      this.detectedRhythmicPatterns = Math.max(0, this.detectedRhythmicPatterns - 1);
    }
    return this.fingerDetectionConfirmed;
  }

  private calculateAdaptiveThreshold(values: number[]): number {
    const sortedValues = [...values].sort((a, b) => a - b);
    const q25Index = Math.floor(sortedValues.length * 0.25);
    const q75Index = Math.floor(sortedValues.length * 0.75);
    const q25 = sortedValues[q25Index];
    const q75 = sortedValues[q75Index];
    const iqr = q75 - q25;
    const baseThreshold = q25 + (iqr * 0.7);
    return Math.max(this.config.peakDetectionThreshold * 0.7, baseThreshold);
  }
} 