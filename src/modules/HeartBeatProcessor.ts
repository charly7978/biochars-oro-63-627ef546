
export class HeartBeatProcessor {
  // ────────── CONFIGURACIONES PRINCIPALES ──────────
  private readonly SAMPLE_RATE = 30;
  private readonly WINDOW_SIZE = 60;
  private readonly MIN_BPM = 40; // Adjusted lower limit for better detection
  private readonly MAX_BPM = 190; // Reduced from 200 to avoid unrealistic values
  private readonly SIGNAL_THRESHOLD = 0.35; // Reduced from 0.40 for better sensitivity
  private readonly MIN_CONFIDENCE = 0.65; // Increased from 0.60 for fewer false positives
  private readonly DERIVATIVE_THRESHOLD = -0.025; // Adjusted for better peak detection
  private readonly MIN_PEAK_TIME_MS = 350; // Increased from 400 for better bradycardia detection
  private readonly WARMUP_TIME_MS = 3000;

  // Parámetros de filtrado
  private readonly MEDIAN_FILTER_WINDOW = 5; // Increased from 3 for better smoothing
  private readonly MOVING_AVERAGE_WINDOW = 5; // Increased from 3 for better smoothing
  private readonly EMA_ALPHA = 0.35; // Reduced from 0.4 for smoother signal
  private readonly BASELINE_FACTOR = 0.98; // Changed from 1.0 for better baseline tracking

  // Parámetros de beep
  private readonly BEEP_PRIMARY_FREQUENCY = 880;
  private readonly BEEP_SECONDARY_FREQUENCY = 440;
  private readonly BEEP_DURATION = 80;
  private readonly BEEP_VOLUME = 0.9;
  private readonly MIN_BEEP_INTERVAL_MS = 300;

  // ────────── AUTO-RESET SI LA SEÑAL ES MUY BAJA ──────────
  private readonly LOW_SIGNAL_THRESHOLD = 0.025; // Reduced from 0.03 for earlier reset
  private readonly LOW_SIGNAL_FRAMES = 12; // Increased from 10 for more stability
  private lowSignalCount = 0;

  // Parameters for improved BPM calculation
  private readonly BPM_HISTORY_SIZE = 15; // Increased from implicit 12 for better averaging
  private readonly BPM_OUTLIER_THRESHOLD = 20; // New parameter for outlier rejection
  private readonly BPM_ALPHA = 0.15; // Reduced from 0.2 for smoother transitions

  // Variables internas
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
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  
  // New variables for improved BPM stability
  private consecutiveValidIntervals: number = 0;
  private lastValidBPM: number = 0;
  private consistentBpmCounter: number = 0;

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

      // Envelope del sonido principal
      primaryGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.01
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + this.BEEP_DURATION / 1000
      );

      // Envelope del sonido secundario
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
    // Enhanced multi-stage filtering for better noise reduction
    const medVal = this.medianFilter(value);
    const movAvgVal = this.calculateMovingAverage(medVal);
    const smoothed = this.calculateEMA(movAvgVal);

    this.signalBuffer.push(smoothed);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Not enough data for analysis yet
    if (this.signalBuffer.length < 30) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: smoothed,
        arrhythmiaCount: 0
      };
    }

    // Improved baseline tracking with adaptive factor
    if (this.baseline === 0) {
      this.baseline = smoothed;
    } else {
      // Use faster adaptation during initial phase
      const adaptationFactor = this.signalBuffer.length < 45 ? 
                               0.97 : this.BASELINE_FACTOR;
      this.baseline = this.baseline * adaptationFactor + smoothed * (1 - adaptationFactor);
    }

    const normalizedValue = smoothed - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    // Improved derivative calculation using window approach
    this.values.push(smoothed);
    if (this.values.length > 3) {
      this.values.shift();
    }

    let smoothDerivative = smoothed - this.lastValue;
    if (this.values.length === 3) {
      // Center difference formula for better derivative approximation
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }
    this.lastValue = smoothed;

    // Enhanced peak detection with adaptive thresholds
    const { isPeak, confidence } = this.detectPeak(normalizedValue, smoothDerivative);
    const isConfirmedPeak = this.confirmPeak(isPeak, normalizedValue, confidence);

    if (isConfirmedPeak && !this.isInWarmup()) {
      const now = Date.now();
      const timeSinceLastPeak = this.lastPeakTime
        ? now - this.lastPeakTime
        : Number.MAX_VALUE;

      if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
        this.previousPeakTime = this.lastPeakTime;
        this.lastPeakTime = now;
        this.playBeep(0.12);
        this.updateBPM();
      }
    }

    // Get smoothed BPM with confidence-based weighting
    const currentBPM = this.getSmoothBPM();
    
    return {
      bpm: Math.round(currentBPM),
      confidence: confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: smoothed,
      arrhythmiaCount: 0
    };
  }

  private autoResetIfSignalIsLow(amplitude: number) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
      }
    } else {
      // Decrement counter more gradually to prevent rapid toggling
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 0.5);
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
    this.consecutiveValidIntervals = 0;
    this.consistentBpmCounter = 0;
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  private detectPeak(normalizedValue: number, derivative: number): {
    isPeak: boolean;
    confidence: number;
  } {
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;

    // Refractory period check - don't detect peaks too close together
    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }

    // Improved peak detection criteria
    const isOverThreshold =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > this.SIGNAL_THRESHOLD &&
      this.lastValue > this.baseline * 0.98;

    // More nuanced confidence calculation based on amplitude and derivative
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.5), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD * 0.75), 0),
      1
    );
    
    // Add timing factor - penalize peaks that come too soon or too late
    let timingConfidence = 1.0;
    if (this.lastPeakTime && this.previousPeakTime) {
      const expectedInterval = (this.lastPeakTime - this.previousPeakTime);
      const expectedNextPeak = this.lastPeakTime + expectedInterval;
      const deviation = Math.abs(now - expectedNextPeak);
      
      // If deviation is more than 40% of the interval, reduce confidence
      if (deviation > expectedInterval * 0.4) {
        timingConfidence = Math.max(0.5, 1 - deviation / (expectedInterval * 1.2));
      }
    }

    // Calculate weighted confidence
    const confidence = (amplitudeConfidence * 0.45 + derivativeConfidence * 0.45 + timingConfidence * 0.1);

    return { isPeak: isOverThreshold, confidence };
  }

  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): boolean {
    // Update peak confirmation buffer
    this.peakConfirmationBuffer.push(normalizedValue);
    if (this.peakConfirmationBuffer.length > 5) {
      this.peakConfirmationBuffer.shift();
    }
    
    // Calculate average buffer value for stability
    const avgBuffer = this.peakConfirmationBuffer.reduce((a, b) => a + b, 0) / 
                      this.peakConfirmationBuffer.length;
    
    // Enhanced peak confirmation logic with multiple criteria
    if (isPeak && !this.lastConfirmedPeak && confidence >= this.MIN_CONFIDENCE && 
        avgBuffer > this.SIGNAL_THRESHOLD * 0.9) {
      
      if (this.peakConfirmationBuffer.length >= 3) {
        const len = this.peakConfirmationBuffer.length;
        
        // Check if we're past the peak (values going down)
        const goingDown1 = this.peakConfirmationBuffer[len - 1] < this.peakConfirmationBuffer[len - 2];
        const goingDown2 = this.peakConfirmationBuffer[len - 2] < this.peakConfirmationBuffer[len - 3];
        
        if (goingDown1 && goingDown2) {
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
    
    // Improved BPM validation with stricter physiological limits
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      // Check for outliers compared to previous values
      let isOutlier = false;
      
      if (this.bpmHistory.length > 3) {
        // Calculate median of recent values for outlier detection
        const recentBpms = [...this.bpmHistory].slice(-3);
        recentBpms.sort((a, b) => a - b);
        const medianBPM = recentBpms[Math.floor(recentBpms.length / 2)];
        
        // Mark as outlier if it deviates too much from recent median
        if (Math.abs(instantBPM - medianBPM) > this.BPM_OUTLIER_THRESHOLD) {
          isOutlier = true;
          console.log("HeartBeatProcessor: BPM outlier rejected", {
            instantBPM,
            medianBPM,
            difference: Math.abs(instantBPM - medianBPM)
          });
        }
      }
      
      if (!isOutlier) {
        this.bpmHistory.push(instantBPM);
        if (this.bpmHistory.length > this.BPM_HISTORY_SIZE) {
          this.bpmHistory.shift();
        }
        
        // Track consecutive valid intervals for stability assessment
        this.consecutiveValidIntervals++;
        this.lastValidBPM = instantBPM;
      }
    } else {
      // Reset consecutive counter on invalid values
      this.consecutiveValidIntervals = 0;
      console.log("HeartBeatProcessor: Invalid BPM rejected", { instantBPM });
    }
  }

  private getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    
    // Handle no data case
    if (rawBPM === 0) {
      return this.smoothBPM > 0 ? this.smoothBPM * 0.95 : 0; // Gradual decay if no new data
    }
    
    // Initialize smooth BPM if needed
    if (this.smoothBPM === 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    
    // Check for significant jumps that might indicate errors
    const bpmDifference = Math.abs(rawBPM - this.smoothBPM);
    
    if (bpmDifference > 15 && this.smoothBPM > 0) {
      // For large changes, adapt more slowly to prevent jumps
      this.smoothBPM = this.smoothBPM + (Math.sign(rawBPM - this.smoothBPM) * 
                       Math.min(bpmDifference * 0.1, 2));
      
      // Log significant changes for debugging
      console.log("HeartBeatProcessor: Large BPM change detected", {
        raw: rawBPM,
        smooth: this.smoothBPM,
        difference: bpmDifference
      });
    } else {
      // Normal smoothing for small changes
      this.smoothBPM =
        this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
      
      // Increment consistency counter if values are close
      if (bpmDifference < 5) {
        this.consistentBpmCounter = Math.min(10, this.consistentBpmCounter + 1);
      } else {
        this.consistentBpmCounter = Math.max(0, this.consistentBpmCounter - 1);
      }
    }
    
    return this.smoothBPM;
  }

  private calculateCurrentBPM(): number {
    if (this.bpmHistory.length < 2) {
      return 0;
    }
    
    // Copy and sort BPM history for robust statistical analysis
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Improved outlier rejection - remove more extreme values in larger datasets
    let trimAmount = Math.floor(sorted.length * 0.15); // 15% trim
    trimAmount = Math.min(Math.max(trimAmount, 1), 3); // At least 1, at most 3
    
    // Trim both ends to remove outliers
    const trimmed = sorted.slice(trimAmount, sorted.length - trimAmount);
    
    if (!trimmed.length) return 0;
    
    // Calculate mean of trimmed array
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
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
}
