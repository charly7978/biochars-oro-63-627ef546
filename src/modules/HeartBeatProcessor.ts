import { ArrhythmiaDetectionResult } from '@/services/ArrhythmiaDetectionService';

interface HeartBeatResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue: number;
  arrhythmiaCount: number;
  isArrhythmia?: boolean;
  rrData?: { intervals: number[]; lastPeakTime: number | null };
}

export class HeartBeatProcessor {
  SAMPLE_RATE = 30;
  WINDOW_SIZE = 60;
  MIN_BPM = 40;
  MAX_BPM = 200;
  SIGNAL_THRESHOLD = 0.60;
  MIN_CONFIDENCE = 0.50;
  DERIVATIVE_THRESHOLD = -0.03;
  MIN_PEAK_TIME_MS = 300;
  WARMUP_TIME_MS = 2000;

  MEDIAN_FILTER_WINDOW = 3;
  MOVING_AVERAGE_WINDOW = 5;
  EMA_ALPHA = 0.3;
  BASELINE_FACTOR = 0.995;

  BEEP_PRIMARY_FREQUENCY = 880;
  BEEP_SECONDARY_FREQUENCY = 440;
  BEEP_DURATION = 80;
  BEEP_VOLUME = 0.8;
  MIN_BEEP_INTERVAL_MS = 250;

  LOW_SIGNAL_THRESHOLD = 0.03;
  LOW_SIGNAL_FRAMES = 10;
  lowSignalCount = 0;

  FORCE_IMMEDIATE_BEEP = true;
  SKIP_TIMING_VALIDATION = true;
  
  private isMonitoring = false;

  signalBuffer: number[] = [];
  medianBuffer: number[] = [];
  movingAverageBuffer: number[] = [];
  smoothedValue = 0;
  audioContext = null;
  lastBeepTime = 0;
  lastPeakTime: number | null = null;
  previousPeakTime: number | null = null;
  bpmHistory: number[] = [];
  baseline = 0;
  lastValue = 0;
  values: number[] = [];
  startTime = 0;
  peakConfirmationBuffer: number[] = [];
  lastConfirmedPeak = false;
  smoothBPM = 0;
  BPM_ALPHA = 0.2;
  peakCandidateIndex: number | null = null;
  peakCandidateValue = 0;
  rrIntervals: number[] = [];

  constructor() {
    this.reset();
  }

  setMonitoring(monitoring: boolean): void {
    this.isMonitoring = monitoring;
    if (monitoring && this.startTime === 0) {
      this.startTime = Date.now();
      console.log("HeartBeatProcessor monitoring started.");
    } else if (!monitoring) {
      console.log("HeartBeatProcessor monitoring stopped.");
    }
  }

  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  isInWarmup() {
    if (!this.isMonitoring) return true;
    return this.startTime === 0 || Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }

  medianFilter(value: number): number {
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.MEDIAN_FILTER_WINDOW) {
      this.medianBuffer.shift();
    }
    if (this.medianBuffer.length === this.MEDIAN_FILTER_WINDOW) {
      const sorted = [...this.medianBuffer].sort((a, b) => a - b);
      return sorted[Math.floor(this.MEDIAN_FILTER_WINDOW / 2)];
    }
    return value;
  }

  calculateMovingAverage(value: number): number {
    this.movingAverageBuffer.push(value);
    if (this.movingAverageBuffer.length > this.MOVING_AVERAGE_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    if (this.movingAverageBuffer.length === this.MOVING_AVERAGE_WINDOW) {
      const sum = this.movingAverageBuffer.reduce((a, b) => a + b, 0);
      return sum / this.MOVING_AVERAGE_WINDOW;
    }
    return value;
  }

  calculateEMA(value: number): number {
    this.smoothedValue = this.EMA_ALPHA * value + (1 - this.EMA_ALPHA) * this.smoothedValue;
    return this.smoothedValue;
  }

  processSignal(value: number): HeartBeatResult {
    if (!this.isMonitoring) {
      return this.createDefaultResult();
    }

    const currentTime = Date.now();
    this.values.push(value);
    if (this.values.length > this.WINDOW_SIZE) {
      this.values.shift();
    }

    const medianFiltered = this.medianFilter(value);
    const movingAverageFiltered = this.calculateMovingAverage(medianFiltered);
    const filteredValue = this.calculateEMA(movingAverageFiltered);

    this.baseline = this.baseline * this.BASELINE_FACTOR + filteredValue * (1 - this.BASELINE_FACTOR);

    const normalizedValue = filteredValue - this.baseline;
    const derivative = normalizedValue - (this.lastValue || 0);
    this.lastValue = normalizedValue;

    let isPeak = false;
    let confidence = 0;
    let isConfirmedPeak = false;

    if (!this.isInWarmup()) {
      const peakResult = this.detectPeak(normalizedValue, derivative);
      isPeak = peakResult.isPeak;
      confidence = peakResult.confidence;

      const confirmationResult = this.confirmPeak(isPeak, normalizedValue, confidence);
      isConfirmedPeak = confirmationResult.isConfirmedPeak;

      if (isConfirmedPeak) {
        this.lastConfirmedPeak = true;
        this.updateBPM();
      } else {
        this.lastConfirmedPeak = false;
      }
    } else {
      this.lastConfirmedPeak = false;
      this.peakConfirmationBuffer = [];
    }

    const finalBPM = this.getSmoothBPM();

    const result: HeartBeatResult = {
      bpm: finalBPM,
      confidence: confidence,
      isPeak: isConfirmedPeak,
      filteredValue: filteredValue,
      arrhythmiaCount: 0,
      isArrhythmia: false,
      rrData: { intervals: this.rrIntervals, lastPeakTime: this.lastPeakTime }
    };

    return result;
  }

  private detectPeak(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
  } {
    let isPeak = false;
    let confidence = 0;
    const currentTime = Date.now();

    if (this.lastPeakTime === null || currentTime - this.lastPeakTime > this.MIN_PEAK_TIME_MS) {
      if (derivative < this.DERIVATIVE_THRESHOLD && normalizedValue > (this.peakCandidateValue ?? 0)) {
        this.peakCandidateValue = normalizedValue;
        this.peakCandidateIndex = this.values.length - 1;
      } else if (this.peakCandidateValue !== null && derivative > 0 && normalizedValue < this.peakCandidateValue * 0.8) {
        if (this.peakCandidateValue > this.SIGNAL_THRESHOLD) {
          isPeak = true;
          confidence = Math.min(1, this.peakCandidateValue / (this.SIGNAL_THRESHOLD * 1.5));
          this.peakCandidateValue = 0;
          this.peakCandidateIndex = null;
        } else {
          this.peakCandidateValue = 0;
          this.peakCandidateIndex = null;
        }
      }
    }

    if (this.peakCandidateIndex !== null && (this.values.length - 1) - this.peakCandidateIndex > 10) {
      this.peakCandidateValue = 0;
      this.peakCandidateIndex = null;
    }

    return { isPeak, confidence };
  }

  autoResetIfSignalIsLow(amplitude: number) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
    } else {
      this.lowSignalCount = 0;
    }

    if (this.lowSignalCount > this.LOW_SIGNAL_FRAMES * 3) {
      console.warn("Signal consistently low, auto-resetting HeartBeatProcessor states.");
      this.resetDetectionStates();
      this.lowSignalCount = 0;
    }
  }

  resetDetectionStates() {
    console.log("Resetting peak detection states.");
    this.peakCandidateValue = 0;
    this.peakCandidateIndex = null;
    this.peakConfirmationBuffer = [];
    this.lastConfirmedPeak = false;
    this.lastValue = 0;
  }

  confirmPeak(isPeak: boolean, normalizedValue: number, confidence: number): { isConfirmedPeak: boolean; updatedBuffer: number[]; updatedLastConfirmedPeak: boolean; } {
    let isConfirmedPeak = false;
    const detectionValue = (isPeak && confidence >= this.MIN_CONFIDENCE) ? 1 : 0;
    this.peakConfirmationBuffer.push(detectionValue);

    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }

    if (this.peakConfirmationBuffer.length === 5) {
      const sum = this.peakConfirmationBuffer.reduce((a, b) => a + b, 0);
      if (sum >= 3 && this.lastConfirmedPeak === false) {
        isConfirmedPeak = true;
      }
    }

    const updatedLastConfirmedPeak = this.lastConfirmedPeak;

    return {
      isConfirmedPeak: isConfirmedPeak,
      updatedBuffer: [...this.peakConfirmationBuffer],
      updatedLastConfirmedPeak: updatedLastConfirmedPeak
    };
  }

  private updateBPM(): void {
    const currentTime = Date.now();
    if (this.lastPeakTime !== null) {
      const interval = currentTime - this.lastPeakTime;
      if (interval > 0) {
        const currentBPM = 60000 / interval;
        if (currentBPM >= this.MIN_BPM && currentBPM <= this.MAX_BPM) {
          this.bpmHistory.push(currentBPM);
          this.rrIntervals.push(interval);
          if (this.bpmHistory.length > 10) {
            this.bpmHistory.shift();
          }
          if (this.rrIntervals.length > 30) {
            this.rrIntervals.shift();
          }
        } else {
          console.warn(`Calculated BPM (${currentBPM.toFixed(0)}) out of range [${this.MIN_BPM}-${this.MAX_BPM}]. Interval: ${interval}ms`);
        }
      }
    }
    this.previousPeakTime = this.lastPeakTime;
    this.lastPeakTime = currentTime;
  }

  private getSmoothBPM(): number {
    const currentRawBPM = this.calculateCurrentBPM();
    if (this.smoothBPM === 0) {
      this.smoothBPM = currentRawBPM;
    } else {
      this.smoothBPM = this.BPM_ALPHA * currentRawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    }
    return this.smoothBPM;
  }

  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length === 0) return 0;
    const sortedBPM = [...this.bpmHistory].sort((a, b) => a - b);
    const mid = Math.floor(sortedBPM.length / 2);
    if (sortedBPM.length % 2 === 0) {
      return (sortedBPM[mid - 1] + sortedBPM[mid]) / 2;
    } else {
      return sortedBPM[mid];
    }
  }

  public getFinalBPM(): number {
    return Math.round(this.getSmoothBPM());
  }

  reset() {
    console.log("Resetting HeartBeatProcessor...");
    this.signalBuffer = [];
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.smoothedValue = 0;
    this.lastBeepTime = 0;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.bpmHistory = [];
    this.baseline = 0;
    this.lastValue = 0;
    this.values = [];
    this.startTime = this.isMonitoring ? Date.now() : 0;
    this.peakConfirmationBuffer = [];
    this.lastConfirmedPeak = false;
    this.smoothBPM = 0;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.rrIntervals = [];
    this.lowSignalCount = 0;
  }

  private createDefaultResult(): HeartBeatResult {
    return {
      bpm: 0,
      confidence: 0,
      isPeak: false,
      filteredValue: this.smoothedValue,
      arrhythmiaCount: 0,
      isArrhythmia: false,
      rrData: { intervals: [], lastPeakTime: null }
    };
  }

  getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    return {
      intervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime
    };
  }
}
