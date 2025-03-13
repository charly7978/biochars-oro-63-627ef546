export class HeartBeatProcessor {
  // ────────── OPTIMIZED CONFIGURATION PARAMETERS ──────────
  private readonly SAMPLE_RATE = 30;
  private readonly WINDOW_SIZE = 60;
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 200;
  private readonly SIGNAL_THRESHOLD = 0.35; // Reduced for better sensitivity 
  private readonly MIN_CONFIDENCE = 0.45; // Reduced for better peak detection
  private readonly DERIVATIVE_THRESHOLD = -0.025; // Adjusted for better sensitivity
  private readonly MIN_PEAK_TIME_MS = 350; // Slightly reduced for faster detection
  private readonly WARMUP_TIME_MS = 2000; // Reduced warmup time

  // Optimized filtering parameters
  private readonly MEDIAN_FILTER_WINDOW = 3;
  private readonly MOVING_AVERAGE_WINDOW = 5; // Increased for smoother signal
  private readonly EMA_ALPHA = 0.35; // Adjusted for better signal smoothing
  private readonly BASELINE_FACTOR = 0.998; // Improved adaptive baseline

  // Audio feedback parameters - adjusted for better synchronization
  private readonly BEEP_PRIMARY_FREQUENCY = 880;
  private readonly BEEP_SECONDARY_FREQUENCY = 440;
  private readonly BEEP_DURATION = 80;
  private readonly BEEP_VOLUME = 0.9;
  private readonly MIN_BEEP_INTERVAL_MS = 50; // Reduced to allow more responsive beeping

  // Auto-reset parameters
  private readonly LOW_SIGNAL_THRESHOLD = 0.02; // Reduced for better sensitivity
  private readonly LOW_SIGNAL_FRAMES = 15; // Increased to prevent premature resets
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
  
  // Peak visualization and timing variables
  private detectedPeaks: {timestamp: number, value: number, isArrhythmia?: boolean}[] = [];
  private readonly MAX_STORED_PEAKS = 40; // Increased to store more peaks
  private processingLatency: number = 0;
  private lastProcessingTime: number = 0;
  private processingCount: number = 0;

  constructor() {
    this.initAudio();
    this.startTime = Date.now();
    console.log("HeartBeatProcessor: Initialized with calibrated parameters", {
      timestamp: this.startTime,
      timeString: new Date(this.startTime).toISOString(),
      thresholds: {
        signal: this.SIGNAL_THRESHOLD,
        derivative: this.DERIVATIVE_THRESHOLD,
        confidence: this.MIN_CONFIDENCE
      }
    });
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

      // Immediate sound onset with minimal delay for better sync
      primaryGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      secondaryGain.gain.setValueAtTime(volume * 0.3, this.audioContext.currentTime);
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

      primaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000);
      secondaryOscillator.stop(this.audioContext.currentTime + this.BEEP_DURATION / 1000);

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
    rrData?: {
      intervals: number[];
      lastPeakTime: number | null;
    };
    detectedPeaks?: {timestamp: number, value: number, isArrhythmia?: boolean}[];
  } {
    const processingStartTime = performance.now();
    this.processingCount++;
    const now = Date.now();
    
    // Regularly log input for debugging
    if (this.processingCount % 10 === 0) {
      console.log("HeartBeatProcessor: Processing signal", { 
        value: value.toFixed(4),
        timestamp: now,
        timeString: new Date(now).toISOString(),
        peakCount: this.detectedPeaks.length
      });
    }
    
    // Enhanced signal filtering chain
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    if (this.signalBuffer.length < 15) { // Reduced minimum buffer size for faster startup
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0,
        detectedPeaks: []
      };
    }

    // Improved adaptive baseline
    this.baseline =
      this.baseline * this.BASELINE_FACTOR + smoothed * (1 - this.BASELINE_FACTOR);

    const normalizedValue = smoothed - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    // Better derivative calculation
    let smoothDerivative = smoothed - this.lastValue;
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }
    this.lastValue = smoothed;

    // Enhanced peak detection
    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    if (isConfirmedPeak && !this.isInWarmup()) {
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        
        // Check for arrhythmia in this peak
        const isArrhythmia = this.checkForArrhythmia();
        
        // Calculate a higher scaled value for better visibility, multiplied by 100
        const scaledValue = Math.max(20, normalizedValue * 100);
        
        // Store peak with arrhythmia information
        this.detectedPeaks.push({
          timestamp: now,
          value: scaledValue,
          isArrhythmia
        });
        
        // Play beep immediately when we detect a peak for better synchronization
        this.playBeep(isArrhythmia ? 0.15 : 0.12);
        
        // Limit stored peaks
        if (this.detectedPeaks.length > this.MAX_STORED_PEAKS) {
          this.detectedPeaks.shift();
        }
        
        this.updateBPM();
        
        console.log("HeartBeatProcessor: PEAK CONFIRMED", {
          timestamp: now,
          timeString: new Date(now).toISOString(),
          normalizedValue: normalizedValue.toFixed(4),
          scaledValue: scaledValue.toFixed(1),
          confidence: confidence.toFixed(2),
          isArrhythmia,
          timeSinceLastPeak: timeSinceLastPeak,
          bpm: this.getSmoothBPM(),
          totalPeaks: this.detectedPeaks.length
        });
      }
    }
    
    // Calculate processing latency
    const processingEndTime = performance.now();
    this.processingLatency = processingEndTime - processingStartTime;
    this.lastProcessingTime = now;
    
    // Clean old peaks (more than 15 seconds)
    const fifteenSecondsAgo = now - 15000;
    this.detectedPeaks = this.detectedPeaks.filter(peak => peak.timestamp > fifteenSecondsAgo);

    const rrData = {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
    
    // Detailed logging
    if (this.processingCount % 50 === 0) {
      console.log("HeartBeatProcessor: Current state", {
        bpm: this.getSmoothBPM().toFixed(1),
        peakCount: this.detectedPeaks.length,
        bpmHistoryLength: this.bpmHistory.length,
        lastPeakTime: this.lastPeakTime ? new Date(this.lastPeakTime).toISOString() : "none",
        processingLatency: this.processingLatency.toFixed(2) + "ms",
        runningTime: (now - this.startTime).toFixed(0) + "ms",
        baseline: this.baseline.toFixed(4),
        signalBufferSize: this.signalBuffer.length
      });
    }

    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: smoothed,
      arrhythmiaCount: this.detectedPeaks.filter(p => p.isArrhythmia).length,
      rrData,
      detectedPeaks: [...this.detectedPeaks]
    };
  }

  private autoResetIfSignalIsLow(amplitude: number) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
      }
    } else {
      this.lowSignalCount = 0;
    }
  }

  private resetDetectionStates() {
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.peakConfirmationBuffer = [];
    this.values = [];
    this.detectedPeaks = [];
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  private checkForArrhythmia(): boolean {
    if (this.bpmHistory.length < 3) return false;
    
    const recentIntervals = this.bpmHistory.slice(-3);
    const avg = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
    const lastBpm = recentIntervals[recentIntervals.length - 1];
    
    // Check for significant deviation (>20% from average)
    const percentDiff = Math.abs(lastBpm - avg) / avg;
    const isArrhythmia = percentDiff > 0.2;
    
    if (isArrhythmia) {
      console.log("HeartBeatProcessor: Arrhythmia detected", {
        lastBpm: lastBpm.toFixed(1),
        avgBpm: avg.toFixed(1),
        percentDiff: (percentDiff * 100).toFixed(1) + "%",
        timestamp: new Date().toISOString()
      });
    }
    
    return isArrhythmia;
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

    // Improved peak detection algorithm
    const isOverThreshold =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > this.SIGNAL_THRESHOLD &&
      this.lastValue > this.baseline * 0.95; // Reduced baseline factor for better sensitivity

    // Enhanced confidence calculation
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.5), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD * 0.7), 0),
      1
    );

    // Weighted confidence calculation
    const confidence = (amplitudeConfidence * 0.6 + derivativeConfidence * 0.4);

    if (this.processingCount % 10 === 0) {
      console.log("HeartBeatProcessor: Peak detection values:", {
        normalizedValue: normalizedValue.toFixed(4),
        derivative: derivative.toFixed(4),
        isOverThreshold,
        threshold: this.SIGNAL_THRESHOLD,
        confidence: confidence.toFixed(2),
        minConfidence: this.MIN_CONFIDENCE
      });
    }

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
    
    // Improved peak confirmation logic
    const avgBuffer = this.peakConfirmationBuffer.reduce((a, b) => a + b, 0) / 
                     Math.max(1, this.peakConfirmationBuffer.length);
    
    // More robust peak confirmation
    const confirmationResult = isPeak && 
                               !this.lastConfirmedPeak && 
                               confidence >= this.MIN_CONFIDENCE && 
                               avgBuffer > this.SIGNAL_THRESHOLD * 0.9;
    
    if (confirmationResult) {
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        const goingDown1 = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        const goingDown2 = len >= 3 ? 
                          this.peakConfirmationBuffer[len - 2] < this.peakConfirmationBuffer[len - 3] : 
                          true;
        
        const peakConfirmed = goingDown1 && goingDown2;
        
        if (peakConfirmed) {
          console.log("HeartBeatProcessor: Peak confirmation details", {
            normalizedValue: normalizedValue.toFixed(4),
            confidence: confidence.toFixed(2),
            bufferValues: this.peakConfirmationBuffer.map(v => v.toFixed(4)),
            goingDown1,
            goingDown2
          });
          
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
      
      console.log("HeartBeatProcessor: BPM Actualizado", {
        instantBPM: instantBPM.toFixed(1),
        interval: interval.toFixed(0) + "ms",
        historySize: this.bpmHistory.length,
        smoothBPM: this.getSmoothBPM().toFixed(1),
        timestamp: Date.now(),
        timeString: new Date().toISOString()
      });
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
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
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

  public reset() {
    console.log("HeartBeatProcessor: Reseteando todos los valores", {
      bpmHistory: this.bpmHistory.length,
      peakCount: this.detectedPeaks.length,
      timestamp: Date.now(),
      timeString: new Date().toISOString()
    });
    
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
    this.detectedPeaks = [];
    this.processingLatency = 0;
    this.lastProcessingTime = 0;
    this.processingCount = 0;
    
    console.log("HeartBeatProcessor: Reset completado");
  }

  public getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
  
  public getProcessingStats(): { latency: number, lastProcessingTime: number } {
    return {
      latency: this.processingLatency,
      lastProcessingTime: this.lastProcessingTime
    };
  }
  
  public getDetectedPeaks(): {timestamp: number, value: number, isArrhythmia?: boolean}[] {
    return this.detectedPeaks.map(peak => ({
      timestamp: peak.timestamp,
      value: peak.value,
      isArrhythmia: peak.isArrhythmia || false
    }));
  }
}
