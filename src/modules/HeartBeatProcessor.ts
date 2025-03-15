
export class HeartBeatProcessor {
  // ────────── PRIMARY CONFIGURATIONS ──────────
  private readonly SAMPLE_RATE = 30;
  private readonly WINDOW_SIZE = 60;
  private readonly MIN_BPM = 30; // Lowered to catch bradycardia
  private readonly MAX_BPM = 220; // Increased to catch tachycardia
  private readonly SIGNAL_THRESHOLD = 0.15; // Reduced for higher sensitivity 
  private readonly MIN_CONFIDENCE = 0.25; // Reduced for detection with weaker signals
  private readonly DERIVATIVE_THRESHOLD = -0.008; // Increased to detect subtler peaks 
  private readonly MIN_PEAK_TIME_MS = 270; // Reduced to allow higher heart rates
  private readonly WARMUP_TIME_MS = 1000; // Reduced to start detecting sooner

  // Filtering parameters
  private readonly MEDIAN_FILTER_WINDOW = 3;
  private readonly MOVING_AVERAGE_WINDOW = 3;
  private readonly EMA_ALPHA = 0.5; // Increased for faster response
  private readonly BASELINE_FACTOR = 0.95; // Adjusted for better baseline tracking

  // Beep parameters - NOT MODIFIED as requested
  private readonly BEEP_PRIMARY_FREQUENCY = 880;
  private readonly BEEP_SECONDARY_FREQUENCY = 440;
  private readonly BEEP_DURATION = 80;
  private readonly BEEP_VOLUME = 0.9;
  private readonly MIN_BEEP_INTERVAL_MS = 300;

  // ────────── AUTO-RESET IF SIGNAL IS VERY LOW ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.008; // Reduced to avoid frequent resets
  private readonly LOW_SIGNAL_FRAMES = 40; // Increased to give more time before reset
  private lowSignalCount = 0;

  // Internal variables
  private signalBuffer: number[] = [];
  private medianBuffer: number[] = [];
  private movingAverageBuffer: number[] = [];
  private smoothedValue: number = 0;
  private audioContext: AudioContext | null = null;
  private lastBeepTime = 0;
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private bpmHistory: number[] = [];
  private baseline: number = 0;
  private lastValue: number = 0;
  private values: number[] = [];
  private startTime: number = 0;
  private peakConfirmationBuffer: number[] = [];
  private lastConfirmedPeak: boolean = false;
  private smoothBPM: number = 0;
  private readonly BPM_ALPHA = 0.2;
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
  }

  private async initAudio() {
    try {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      await this.playBeep(0.01);
      console.log("HeartBeatProcessor: Audio Context Initialized");
    } catch (error) {
      console.error("HeartBeatProcessor: Error initializing audio", error);
    }
  }

  private async playBeep(volume: number = this.BEEP_VOLUME) {
    if (!this.audioContext || this.isInWarmup()) return;

    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) return;

    try {
      const primaryOscillator = this.audioContext.createOscillator();
      const primaryGain = this.audioContext.createGain();

      const secondaryOscillator = this.audioContext.createOscillator();
      const secondaryGain = this.audioContext.createGain();

      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(
        this.BEEP_PRIMARY_FREQUENCY,
        this.audioContext.currentTime
      );

      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(
        this.BEEP_SECONDARY_FREQUENCY,
        this.audioContext.currentTime
      );

      // Sound envelope for primary
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.01
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Sound envelope for secondary
      secondaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        volume * 0.3,
        this.audioContext.currentTime + 0.01
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(this.audioContext.destination);
      secondaryGain.connect(this.audioContext.destination);

      primaryOscillator.start();
      secondaryOscillator.start();

      primaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.05);
      secondaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000 + 0.05);

      this.lastBeepTime = now;
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing beep", error);
    }
  }

  private isInWarmup(): boolean {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }

  private medianFilter(value: number): number {
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > this.MEDIAN_FILTER_WINDOW) {
      this.medianBuffer.shift();
    }
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  private calculateMovingAverage(value: number): number {
    this.movingAverageBuffer.push(value);
    if (this.movingAverageBuffer.length > this.MOVING_AVERAGE_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    const sum = this.movingAverageBuffer.reduce((a, b) => a + b, 0);
    return sum / this.movingAverageBuffer.length;
  }

  private calculateEMA(value: number): number {
    this.smoothedValue =
      this.EMA_ALPHA * value + (1 - this.EMA_ALPHA) * this.smoothedValue;
    return this.smoothedValue;
  }

  public processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number;
    arrhythmiaCount: number;
  } {
    // Sequential filters to improve the signal
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Start analyzing sooner with smaller buffer (less waiting)
    if (this.signalBuffer.length < 10) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0
      };
    }

    // More aggressive baseline adjustment to respond to rapid changes
    this.baseline = this.baseline === 0 ? 
      smoothed : 
      this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);

    const normalizedValue = smoothed - this.baseline;
    
    // Only reset if signal is really low for a long time
    if (Math.abs(normalizedValue) < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
    } else {
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 3); // Faster reduction of counter
    }
    
    if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
      this.resetDetectionStates();
      console.log("HeartBeatProcessor: Signal too low, resetting detection states");
    }

    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    // More sensitive derivative calculation
    let smoothDerivative = smoothed - this.lastValue;
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }
    this.lastValue = smoothed;

    // Enhanced peak detection for weaker signals
    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    if (isConfirmedPeak) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        
        // Do not modify beep as requested
        this.playBeep(0.12);
        
        this.updateBPM();
        
        // Diagnostic log
        console.log("HeartBeatProcessor: Beat detected", { 
          timeSinceLastPeak, 
          normalizedValue: normalizedValue.toFixed(4),
          confidence: confidence.toFixed(2)
        });
      }
    }

    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence,
      isPeak: isConfirmedPeak,
      filteredValue: smoothed,
      arrhythmiaCount: 0
    };
  }

  private resetDetectionStates() {
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.peakConfirmationBuffer = [];
    this.values = [];
  }

  private detectPeak(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
  } {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    // More sensitive detection logic
    const isOverThreshold =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > this.SIGNAL_THRESHOLD * 0.6; // Reduced threshold by 40%

    // Improved confidence calculation for lower values
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.2), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD * 0.5), 0),
      1
    );

    // Weighted confidence with more weight on derivative
    const confidence = (amplitudeConfidence * 0.3 + derivativeConfidence * 0.7);

    return { isPeak: isOverThreshold, confidence };
  }

  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }
    
    // Adaptive confidence threshold based on signal strength
    const adaptiveMinConfidence = Math.min(
      this.MIN_CONFIDENCE, 
      this.MIN_CONFIDENCE - Math.min(0.1, normalizedValue * 0.2)
    );
    
    if (isPeak && !this.lastConfirmedPeak && confidence >= adaptiveMinConfidence) {
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        
        // Only one criterion needs to be met
        const goingDown = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        const peakValue = this.peakConfirmationBuffer[len - 2];
        
        if (goingDown) {
          this.lastConfirmedPeak = true;
          return true;
        }
      }
    } else if (!isPeak) {
      this.lastConfirmedPeak = false;
    }
    
    return false;
  }

  private updateBPM() {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;

    const instantBPM = 60000 / interval;
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      this.bpmHistory.push(instantBPM);
      if (this.bpmHistory.length > 12) {
        this.bpmHistory.shift();
      }
    }
  }

  private getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    if (this.smoothBPM === 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    this.smoothBPM =
      this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    return this.smoothBPM;
  }

  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    
    // Use more values but filter outliers for stability
    if (this.bpmHistory.length < 5) {
      // With fewer values, just take the average
      return this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length;
    }
    
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1); // Remove highest and lowest
    if (!trimmed.length) return 0;
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    return avg;
  }

  public getFinalBPM(): number {
    if (this.bpmHistory.length < 5) {
      return 0;
    }
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const cut = Math.round(sorted.length * 0.1);
    const finalSet = sorted.slice(cut, sorted.length - cut);
    if (!finalSet.length) return 0;
    const sum = finalSet.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / finalSet.length);
  }

  public getPPGData(): number[] {
    return [...this.signalBuffer];
  }

  public reset() {
    this.signalBuffer = [];
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.peakConfirmationBuffer = [];
    this.bpmHistory = [];
    this.values = [];
    this.smoothBPM = 0;
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.lastBeepTime = 0;
    this.baseline = 0;
    this.lastValue = 0;
    this.smoothedValue = 0;
    this.startTime = Date.now();
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.lowSignalCount = 0;
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    // Calculate and return actual RR intervals in milliseconds
    const rrIntervals: number[] = [];
    
    if (this.bpmHistory.length > 0) {
      for (const bpm of this.bpmHistory) {
        if (bpm > 0) {
          rrIntervals.push(60000 / bpm);
        }
      }
    }
    
    return {
      intervals: rrIntervals,
      lastPeakTime: this.lastPeakTime
    };
  }
}
