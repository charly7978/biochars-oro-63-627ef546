import { HeartBeatConfig } from '../modules/heart-beat/config';
import { RRIntervalData, PeakData } from '../types/peak';

export interface HeartRateResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue: number;
  rrIntervals: number[];
  lastPeakTime: number | null;
  rrData?: RRIntervalData;
}

export interface FilterOptions {
  medianWindowSize: number;
  movingAvgWindowSize: number;
  emaAlpha: number;
}

class HeartRateService {
  private static instance: HeartRateService;

  // Configuration Constants
  private readonly SAMPLE_RATE = HeartBeatConfig.SAMPLE_RATE;
  private readonly WINDOW_SIZE = HeartBeatConfig.WINDOW_SIZE;
  private readonly MIN_BPM = HeartBeatConfig.MIN_BPM;
  private readonly MAX_BPM = HeartBeatConfig.MAX_BPM;
  private readonly SIGNAL_THRESHOLD = HeartBeatConfig.SIGNAL_THRESHOLD;
  private readonly MIN_CONFIDENCE = HeartBeatConfig.MIN_CONFIDENCE;
  private readonly DERIVATIVE_THRESHOLD = HeartBeatConfig.DERIVATIVE_THRESHOLD;
  private readonly MIN_PEAK_TIME_MS = HeartBeatConfig.MIN_PEAK_TIME_MS;
  private readonly MAX_PEAK_DISTANCE_MS = 60000 / HeartBeatConfig.MIN_BPM;
  private readonly WARMUP_TIME_MS = HeartBeatConfig.WARMUP_TIME_MS;
  private readonly MEDIAN_FILTER_WINDOW = HeartBeatConfig.MEDIAN_FILTER_WINDOW;
  private readonly MOVING_AVERAGE_WINDOW = HeartBeatConfig.MOVING_AVERAGE_WINDOW;
  private readonly EMA_ALPHA = HeartBeatConfig.EMA_ALPHA;
  private readonly BASELINE_FACTOR = HeartBeatConfig.BASELINE_FACTOR;
  private readonly LOW_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD;
  private readonly LOW_SIGNAL_FRAMES = HeartBeatConfig.LOW_SIGNAL_FRAMES;
  private readonly MIN_BEEP_INTERVAL_MS = HeartBeatConfig.MIN_BEEP_INTERVAL_MS;
  private readonly DERIVATIVE_WINDOW = 5; // Example window size

  // State Variables
  private signalBuffer: number[] = [];
  private medianBuffer: number[] = [];
  private movingAverageBuffer: number[] = [];
  private smoothedValue: number = 0;
  private lastBeepTime: number = 0;
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private bpmHistory: number[] = [];
  private baseline: number = 0;
  private lastValue: number = 0; // Last normalized value before peak check
  private values: number[] = []; // Short buffer for derivative
  private startTime: number = 0;
  private peakConfirmationBuffer: number[] = [];
  private lastConfirmedPeak: boolean = false;
  private smoothBPM: number = 75; // Initial guess
  private readonly BPM_ALPHA: number = 0.2;
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  private isMonitoring: boolean = false;
  private lowSignalCount: number = 0;
  private peakListeners: Array<(data: PeakData) => void> = [];
  private vibrationEnabled: boolean = true;
  private rrIntervalHistory: number[] = [];
  // private arrhythmiaDetector: ArrhythmiaDetector; // Assuming ArrhythmiaDetector exists

  // Tracking for RR intervals
  private lastProcessedPeakTime: number = 0; // To prevent duplicate peak processing

  private constructor() {
    this.reset();
    this.checkVibrationAvailability();
    // this.arrhythmiaDetector = new ArrhythmiaDetector();
    // console.log("HeartRateService initialized.");
  }

  public static getInstance(): HeartRateService {
    if (!HeartRateService.instance) {
      HeartRateService.instance = new HeartRateService();
    }
    return HeartRateService.instance;
  }

  private checkVibrationAvailability(): void {
    this.vibrationEnabled = typeof navigator !== 'undefined' && 'vibrate' in navigator;
    if (!this.vibrationEnabled) {
      console.warn("HeartRateService: Vibration API not available.");
    }
  }

  public setMonitoring(isActive: boolean): void {
    this.isMonitoring = isActive;
    if (isActive && this.startTime === 0) {
      this.startTime = Date.now();
      console.log("Monitoring started.");
    } else if (!isActive) {
      console.log("Monitoring stopped.");
      // Optionally reset state when stopping
      // this.reset(); 
    }
  }

  public addPeakListener(listener: (data: PeakData) => void): void {
    if (!this.peakListeners.includes(listener)) {
      this.peakListeners.push(listener);
    }
  }

  public removePeakListener(listener: (data: PeakData) => void): void {
    this.peakListeners = this.peakListeners.filter(l => l !== listener);
  }

  private notifyPeakListeners(data: PeakData): void {
    // Debounce peak notifications slightly to avoid overwhelming listeners
    const now = Date.now();
    if (now - this.lastProcessedPeakTime > this.MIN_BEEP_INTERVAL_MS * 0.5) { 
        this.peakListeners.forEach(listener => {
            try { listener(data); } catch (e) { console.error("Error in peak listener:", e); }
        });
        this.lastProcessedPeakTime = now;
    }
  }

  private triggerHeartbeatFeedback(isArrhythmia: boolean = false, value: number = 0.7): boolean {
    if (!this.vibrationEnabled) return false;
    const now = Date.now();
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      return false; // Debounce vibration/beep
    }
    try {
        navigator.vibrate(isArrhythmia ? [50, 30, 50] : 50); // Different pattern for arrhythmia
    } catch (e) {
        console.warn("Vibration failed:", e);
        this.vibrationEnabled = false; // Disable if it fails once
        return false;
    }
    this.lastBeepTime = now;
    return true;
  }

  public processSignal(value: number): HeartRateResult {
    if (!this.isMonitoring) {
      return { bpm: 0, confidence: 0, isPeak: false, filteredValue: value, rrIntervals: [], lastPeakTime: this.lastPeakTime };
    }

    const now = Date.now();
    if (this.startTime === 0) {
      this.startTime = now;
    }

    this.values.push(value);
    if (this.values.length > this.DERIVATIVE_WINDOW) {
      this.values.shift();
    }

    // Apply filtering
    const { filteredValue, updatedMedianBuffer, updatedMovingAvgBuffer } = this.applyFilters(value, { 
        medianWindowSize: this.MEDIAN_FILTER_WINDOW,
        movingAvgWindowSize: this.MOVING_AVERAGE_WINDOW,
        emaAlpha: this.EMA_ALPHA
    });
    this.medianBuffer = updatedMedianBuffer;
    this.movingAverageBuffer = updatedMovingAvgBuffer;
    this.smoothedValue = filteredValue; // Use the fully filtered value

    // Baseline and normalization
    if (this.signalBuffer.length > this.WINDOW_SIZE / 2) {
      const recentData = this.signalBuffer.slice(-Math.floor(this.WINDOW_SIZE / 2));
      const sortedData = [...recentData].sort((a, b) => a - b);
      this.baseline = sortedData[Math.floor(sortedData.length / 2)]; // Use median as baseline
    } else {
      this.baseline = this.smoothedValue; // Use current value if buffer not filled
    }
    const normalizedValue = this.smoothedValue - this.baseline;

    // Signal quality / Finger detection check (basic)
    const isWeak = this.isWeakSignal(value); // Check raw value for fundamental signal presence
    if (isWeak) {
      this.lowSignalCount++;
      if (this.lowSignalCount > this.LOW_SIGNAL_FRAMES) {
         // Return low confidence if signal is weak for too long
         return { bpm: Math.round(this.smoothBPM), confidence: 0, isPeak: false, filteredValue: this.smoothedValue, rrIntervals: this.rrIntervalHistory, lastPeakTime: this.lastPeakTime };
      }
    } else {
      this.lowSignalCount = 0;
    }
    
    // Store filtered value in main buffer
    this.signalBuffer.push(this.smoothedValue);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Calculate derivative (simple difference)
    let derivative = 0;
    if (this.values.length >= 2) {
        derivative = this.values[this.values.length - 1] - this.values[this.values.length - 2];
    }

    // Peak Detection
    const { isPeak, confidence: peakConfidence } = this.detectPeak(
      normalizedValue,
      derivative,
      now
    );

    // Peak Confirmation
    const { isConfirmedPeak, updatedBuffer, updatedLastConfirmed } = this.confirmPeak(
        isPeak,
        normalizedValue,
        peakConfidence
    );
    this.peakConfirmationBuffer = updatedBuffer;
    this.lastConfirmedPeak = updatedLastConfirmed;

    let currentBPM = this.smoothBPM;
    let bpmConfidence = 0;

    if (isConfirmedPeak) {
      this.bpmHistory = this.updateBPMHistory(now);
      currentBPM = this.calculateBPM();
      this.smoothBPM = this.smoothBPM * (1 - this.BPM_ALPHA) + currentBPM * this.BPM_ALPHA;
      // Confidence increases with more consistent history
      bpmConfidence = Math.min(1, this.bpmHistory.length / 10); // Needs more history for full confidence
      
      const peakData: PeakData = { timestamp: now, value: normalizedValue };
      this.notifyPeakListeners(peakData);
      this.triggerHeartbeatFeedback(false, 0.5); // Trigger basic feedback

      this.lastPeakTime = now; // Update last peak time used for RR interval calculation
      if (this.previousPeakTime !== null) {
        const rr = now - this.previousPeakTime;
        if (rr > this.MIN_PEAK_TIME_MS / 2 && rr < this.MAX_PEAK_DISTANCE_MS * 1.5) { // Basic RR plausibility check
            this.rrIntervalHistory.push(rr);
            if(this.rrIntervalHistory.length > 20) this.rrIntervalHistory.shift();
        }
      }
      this.previousPeakTime = now;

    } else {
      // Decay confidence if no peak is detected
      bpmConfidence = Math.max(0, bpmConfidence * 0.95 - 0.02); // Slower decay
      currentBPM = this.smoothBPM; // Maintain smoothed BPM
    }

    // Final confidence calculation, considering peak confidence, bpm stability, warmup, and signal quality
    const finalConfidence = Math.max(0, Math.min(1, 
        (peakConfidence * 0.5 + bpmConfidence * 0.5) * // Blend peak and bpm confidence
        (this.isInWarmup() ? 0.3 : 1) *                // Reduce confidence during warmup
        (isWeak ? 0.2 : 1)                             // Reduce confidence if signal is weak
    ));

    this.lastValue = normalizedValue; // Update last processed normalized value

    return {
      bpm: Math.round(this.smoothBPM),
      confidence: finalConfidence,
      isPeak: isConfirmedPeak,
      filteredValue: this.smoothedValue,
      rrIntervals: [...this.rrIntervalHistory], // Return a copy of current intervals
      lastPeakTime: this.lastPeakTime,
      rrData: { intervals: [...this.rrIntervalHistory], lastPeakTime: this.lastPeakTime } // Provide RR data
    };
  }

  private isWeakSignal(value: number): boolean {
    // Check if the raw signal value is outside a plausible range (needs tuning)
    if (value < this.LOW_SIGNAL_THRESHOLD || value > 250) { // Added upper bound check
      return true;
    }
    // Basic amplitude check on recent filtered data if available
    if (this.signalBuffer.length > 10) {
       const recentFiltered = this.signalBuffer.slice(-10);
       const minRecent = Math.min(...recentFiltered);
       const maxRecent = Math.max(...recentFiltered);
       // Use a reasonable default for MIN_SIGNAL_AMPLITUDE as it's not in config
       const MIN_AMPLITUDE_THRESHOLD = 0.02; 
       if ((maxRecent - minRecent) < MIN_AMPLITUDE_THRESHOLD) { 
         // console.log("Weak signal due to low amplitude");
         return true;
       }
    }
    return false;
  }

  private applyFilters(value: number, config: FilterOptions): { 
    filteredValue: number; 
    updatedMedianBuffer: number[]; 
    updatedMovingAvgBuffer: number[]; 
  } {
    // 1. Median Filter
    this.medianBuffer.push(value);
    if (this.medianBuffer.length > config.medianWindowSize) {
      this.medianBuffer.shift();
    }
    const sortedMedian = [...this.medianBuffer].sort((a, b) => a - b);
    const medianValue = sortedMedian[Math.floor(sortedMedian.length / 2)];

    // 2. Moving Average Filter
    this.movingAverageBuffer.push(medianValue); // Filter the median-filtered value
    if (this.movingAverageBuffer.length > config.movingAvgWindowSize) {
      this.movingAverageBuffer.shift();
    }
    const movingAvgValue = this.movingAverageBuffer.length > 0 
                           ? this.movingAverageBuffer.reduce((sum, v) => sum + v, 0) / this.movingAverageBuffer.length
                           : medianValue; // Handle empty buffer case

    // 3. EMA Filter
    this.smoothedValue = this.smoothedValue === 0 
        ? movingAvgValue 
        : (movingAvgValue * config.emaAlpha) + (this.smoothedValue * (1 - config.emaAlpha));

    return { 
        filteredValue: this.smoothedValue, 
        updatedMedianBuffer: [...this.medianBuffer], // Return copies
        updatedMovingAvgBuffer: [...this.movingAverageBuffer] // Return copies
    };
  }

  private detectPeak(
    normalizedValue: number,
    derivative: number,
    currentTime: number
  ): { isPeak: boolean; confidence: number } {
    let isPeak = false;
    let confidence = 0;

    // Peak condition: Above threshold, derivative sign change (positive to negative), sufficient time since last peak
    if (normalizedValue > this.SIGNAL_THRESHOLD && derivative < -this.DERIVATIVE_THRESHOLD && this.lastValue >= normalizedValue) {
      if (this.lastPeakTime === null || (currentTime - this.lastPeakTime) >= this.MIN_PEAK_TIME_MS) {
        isPeak = true;
        // Confidence based on how much it exceeds threshold + derivative strength
        const amplitudeConfidence = Math.min(1, normalizedValue / (this.SIGNAL_THRESHOLD * 2.5));
        const derivativeConfidence = Math.min(1, Math.abs(derivative) / (this.DERIVATIVE_THRESHOLD * 3));
        confidence = (amplitudeConfidence * 0.7) + (derivativeConfidence * 0.3);
      }
    }
    return { isPeak, confidence };
  }

  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): { isConfirmedPeak: boolean; updatedBuffer: number[]; updatedLastConfirmed: boolean; } {
    let isConfirmed = false;
    this.peakConfirmationBuffer.push(isPeak ? normalizedValue : 0); // Store value if peak candidate
    if (this.peakConfirmationBuffer.length > 5) { // Look back window of 5 samples
      this.peakConfirmationBuffer.shift();
    }

    // Require: 
    // 1. Current sample is a peak candidate (isPeak=true)
    // 2. Confidence meets minimum
    // 3. It's higher than its immediate neighbors in the confirmation buffer
    // 4. Wasn't already confirmed in the previous step (avoid double counting)
    if (isPeak && confidence >= this.MIN_CONFIDENCE && !this.lastConfirmedPeak) {
        const bufferLen = this.peakConfirmationBuffer.length;
        const currentIndex = bufferLen - 1;
        
        // Check if it's a local maximum within the small confirmation window
        let isLocalMax = true;
        if (currentIndex > 0 && this.peakConfirmationBuffer[currentIndex] <= this.peakConfirmationBuffer[currentIndex - 1]) {
            isLocalMax = false;
        }
        if (currentIndex < bufferLen - 1 && this.peakConfirmationBuffer[currentIndex] <= this.peakConfirmationBuffer[currentIndex + 1]) {
             // Check against next only if it exists and is non-zero (i.e., also a peak candidate)
            if (this.peakConfirmationBuffer[currentIndex + 1] > 0) {
               isLocalMax = false;
            }
        }
        
        // Add simpler confirmation: at least 2 positive values in window
        const positivePeaksInWindow = this.peakConfirmationBuffer.filter(v => v > 0).length;

        if (isLocalMax && positivePeaksInWindow >= 2) { 
            isConfirmed = true; 
        }
    }

    return { isConfirmedPeak: isConfirmed, updatedBuffer: [...this.peakConfirmationBuffer], updatedLastConfirmed: isConfirmed };
  }

  private updateBPMHistory(now: number): number[] {
    if (this.lastPeakTime !== null) {
      const interval = now - this.lastPeakTime;
      // Stricter validation for intervals used in BPM calculation
      if (interval >= this.MIN_PEAK_TIME_MS && interval <= this.MAX_PEAK_DISTANCE_MS) { 
        const bpm = 60000 / interval;
        if (bpm >= this.MIN_BPM && bpm <= this.MAX_BPM) {
          this.bpmHistory.push(bpm);
          if (this.bpmHistory.length > 10) { // Keep last 10 valid BPM values
            this.bpmHistory.shift();
          }
        }
      }
    }
    // Return a copy to avoid external modification
    return [...this.bpmHistory];
  }

  private calculateBPM(): number {
    if (this.bpmHistory.length < 3) { // Require at least 3 values for stable median
      return this.smoothBPM; // Return smoothed value if not enough history
    }
    // Use median of recent BPM values for robustness
    const sortedBPM = [...this.bpmHistory].sort((a, b) => a - b);
    const mid = Math.floor(sortedBPM.length / 2);
    return sortedBPM.length % 2 !== 0 ? sortedBPM[mid] : (sortedBPM[mid - 1] + sortedBPM[mid]) / 2;
  }

  private isInWarmup(): boolean {
    if (this.startTime === 0) return true;
    return (Date.now() - this.startTime) < this.WARMUP_TIME_MS;
  }

  public reset(): void {
    console.log("Resetting HeartRateService...");
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
    this.startTime = this.isMonitoring ? Date.now() : 0; // Reset start time only if monitoring continues
    this.peakConfirmationBuffer = [];
    this.lastConfirmedPeak = false;
    this.smoothBPM = 75; // Reset to a typical resting rate
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.lowSignalCount = 0;
    this.rrIntervalHistory = [];
    this.lastProcessedPeakTime = 0;
    // this.arrhythmiaDetector.reset(); // Reset arrhythmia detector if exists
  }
}

// --- Funciones Matemáticas Reemplazadas ---
/*
Las siguientes funciones fueron reemplazadas por sus equivalentes de `Math`:
- realMin -> Math.min
- realMax -> Math.max
- realAbs -> Math.abs
- realRound -> Math.round
- realPow -> Math.pow
- realSqrt -> Math.sqrt
- realFloor -> Math.floor
*/ 