
export interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
}

export class PeakDetector {
  private readonly MIN_PEAK_DISTANCE_MS = 600; // Más seguro: BPM máx ≈100
  private readonly MAX_PEAK_DISTANCE_MS = 1500;
  private readonly SAMPLING_RATE = 30;
  private readonly SLOPE_SUM_WINDOW = 8;
  private readonly DERIVATIVE_WINDOW = 5;
  private readonly VERIFICATION_WINDOW = 5;

  private lastPeakIndex: number = -1;
  private lastPeakTime: number = 0;
  private peakThreshold: number = 0.45; // Subido para reducir ruido
  private adaptiveThreshold: number = 0.45;
  private rrIntervals: number[] = [];
  private consecutiveGoodIntervals: number = 0;
  private readonly MIN_GOOD_INTERVALS = 3;

  constructor() {
    this.reset();
  }

  public detectPeaks(values: number[]): {
    peakIndices: number[];
    valleyIndices: number[];
    intervals: number[];
    lastPeakTime: number;
  } {
    if (values.length < this.DERIVATIVE_WINDOW * 2) {
      return {
        peakIndices: [],
        valleyIndices: [],
        intervals: this.rrIntervals,
        lastPeakTime: this.lastPeakTime
      };
    }

    const firstDerivative = this.calculateFirstDerivative(values);
    const slopeSum = this.calculateSlopeSum(firstDerivative);

    this.updateAdaptiveThreshold(slopeSum);

    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];
    const now = Date.now();

    for (let i = this.VERIFICATION_WINDOW; i < slopeSum.length - this.VERIFICATION_WINDOW; i++) {
      const value = slopeSum[i];
      if (value > this.adaptiveThreshold && this.isLocalMaximum(slopeSum, i)) {
        const timeSinceLast = now - this.lastPeakTime;

        if (timeSinceLast > this.MIN_PEAK_DISTANCE_MS && timeSinceLast < this.MAX_PEAK_DISTANCE_MS) {
          const amplitude = Math.abs(values[i] - values[i - 1]);
          if (amplitude > 0.02) { // filtro mínimo de amplitud
            peakIndices.push(i);
            this.rrIntervals.push(timeSinceLast);
            this.lastPeakTime = now;
            this.lastPeakIndex = i;
          }
        }
      }
    }

    return {
      peakIndices,
      valleyIndices,
      intervals: this.rrIntervals,
      lastPeakTime: this.lastPeakTime
    };
  }

  private calculateFirstDerivative(data: number[]): number[] {
    const derivative: number[] = [];
    for (let i = 1; i < data.length; i++) {
      derivative.push(data[i] - data[i - 1]);
    }
    return derivative;
  }

  private calculateSlopeSum(derivative: number[]): number[] {
    const slopeSum: number[] = [];
    for (let i = this.SLOPE_SUM_WINDOW; i < derivative.length; i++) {
      let sum = 0;
      for (let j = 0; j < this.SLOPE_SUM_WINDOW; j++) {
        sum += Math.abs(derivative[i - j]);
      }
      slopeSum.push(sum);
    }
    return slopeSum;
  }

  private updateAdaptiveThreshold(slopeSum: number[]) {
    const max = Math.max(...slopeSum);
    this.adaptiveThreshold = Math.max(this.peakThreshold, max * 0.4);
  }

  private isLocalMaximum(data: number[], index: number): boolean {
    for (let i = index - 2; i <= index + 2; i++) {
      if (i !== index && data[i] >= data[index]) return false;
    }
    return true;
  }

  public reset() {
    this.lastPeakIndex = -1;
    this.lastPeakTime = 0;
    this.rrIntervals = [];
    this.consecutiveGoodIntervals = 0;
  }

  public getRRData(): RRData {
    return {
      intervals: this.rrIntervals,
      lastPeakTime: this.lastPeakTime
    };
  }
}
