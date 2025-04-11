
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { HeartBeatConfig } from './heart-beat/config';
import { applyFilterPipeline } from './heart-beat/signal-filters';
import { detectPeak, confirmPeak } from './heart-beat/peak-detector';
import { updateBPMHistory, calculateCurrentBPM, smoothBPM, calculateFinalBPM } from './heart-beat/bpm-calculator';
import { HeartbeatAudioManager } from './heart-beat/audio-manager';
import { checkSignalQuality, resetSignalQualityState } from './heart-beat/signal-quality';

export class HeartBeatProcessor {
  // Import configuration from config module
  SAMPLE_RATE = HeartBeatConfig.SAMPLE_RATE;
  WINDOW_SIZE = HeartBeatConfig.WINDOW_SIZE;
  MIN_BPM = HeartBeatConfig.MIN_BPM;
  MAX_BPM = HeartBeatConfig.MAX_BPM;
  SIGNAL_THRESHOLD = HeartBeatConfig.SIGNAL_THRESHOLD;
  MIN_CONFIDENCE = HeartBeatConfig.MIN_CONFIDENCE;
  DERIVATIVE_THRESHOLD = HeartBeatConfig.DERIVATIVE_THRESHOLD;
  MIN_PEAK_TIME_MS = HeartBeatConfig.MIN_PEAK_TIME_MS;
  WARMUP_TIME_MS = HeartBeatConfig.WARMUP_TIME_MS;

  MEDIAN_FILTER_WINDOW = HeartBeatConfig.MEDIAN_FILTER_WINDOW;
  MOVING_AVERAGE_WINDOW = HeartBeatConfig.MOVING_AVERAGE_WINDOW;
  EMA_ALPHA = HeartBeatConfig.EMA_ALPHA;
  BASELINE_FACTOR = HeartBeatConfig.BASELINE_FACTOR;

  BEEP_PRIMARY_FREQUENCY = HeartBeatConfig.BEEP_PRIMARY_FREQUENCY;
  BEEP_SECONDARY_FREQUENCY = HeartBeatConfig.BEEP_SECONDARY_FREQUENCY;
  BEEP_DURATION = HeartBeatConfig.BEEP_DURATION;
  BEEP_VOLUME = HeartBeatConfig.BEEP_VOLUME;
  MIN_BEEP_INTERVAL_MS = HeartBeatConfig.MIN_BEEP_INTERVAL_MS;

  LOW_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD;
  LOW_SIGNAL_FRAMES = HeartBeatConfig.LOW_SIGNAL_FRAMES;
  
  // State variables
  signalBuffer: number[] = [];
  medianBuffer: number[] = [];
  movingAverageBuffer: number[] = [];
  smoothedValue: number = 0;
  lastBeepTime: number = 0;
  lastPeakTime: number | null = null;
  previousPeakTime: number | null = null;
  bpmHistory: number[] = [];
  baseline: number = 0;
  lastValue: number = 0;
  values: number[] = [];
  startTime: number = 0;
  peakConfirmationBuffer: number[] = [];
  lastConfirmedPeak: boolean = false;
  smoothBPM: number = 0;
  BPM_ALPHA: number = 0.2;
  peakCandidateIndex: number | null = null;
  peakCandidateValue: number = 0;
  isMonitoring: boolean = false;
  arrhythmiaCounter: number = 0;
  lowSignalCount: number = 0;

  // Audio manager
  audioManager: HeartbeatAudioManager | null = null;

  constructor() {
    this.audioManager = new HeartbeatAudioManager({
      primaryFrequency: this.BEEP_PRIMARY_FREQUENCY,
      secondaryFrequency: this.BEEP_SECONDARY_FREQUENCY,
      beepDuration: this.BEEP_DURATION,
      beepVolume: this.BEEP_VOLUME,
      minBeepInterval: this.MIN_BEEP_INTERVAL_MS
    });
    
    this.initAudio();
    this.startTime = Date.now();
    console.log("HeartBeatProcessor: New instance created - direct measurement mode only");
  }

  async initAudio(): Promise<void> {
    try {
      await this.audioManager?.initAudio();
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing audio", err);
    }
  }

  async playBeep(volume: number = 0.7): Promise<boolean> {
    // Don't play beeps if not monitoring
    if (!this.isMonitoring) {
      console.log("HeartBeatProcessor: Beep requested but monitoring is off");
      return false;
    }
    
    try {
      return await this.audioManager?.playBeep(volume) || false;
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing beep", error);
      return false;
    }
  }
  
  setMonitoring(isActive: boolean): void {
    this.isMonitoring = isActive;
    console.log("HeartBeatProcessor: Monitoring state set to", isActive);
  }

  processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue?: number;
    arrhythmiaCount?: number;
    rrData?: { intervals: number[]; lastPeakTime: number | null };
  } {
    // Check for weak signal
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      value, 
      this.lowSignalCount, 
      {
        lowSignalThreshold: this.LOW_SIGNAL_THRESHOLD,
        maxWeakSignalCount: this.LOW_SIGNAL_FRAMES
      }
    );
    
    this.lowSignalCount = updatedWeakSignalsCount;
    
    if (isWeakSignal) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false
      };
    }
    
    // Update signal buffer
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }
    
    // Apply filters
    const { 
      filteredValue, 
      updatedMedianBuffer, 
      updatedMovingAvgBuffer 
    } = applyFilterPipeline(
      value,
      this.medianBuffer,
      this.movingAverageBuffer,
      this.smoothedValue,
      {
        medianWindowSize: this.MEDIAN_FILTER_WINDOW,
        movingAvgWindowSize: this.MOVING_AVERAGE_WINDOW,
        emaAlpha: this.EMA_ALPHA
      }
    );
    
    this.medianBuffer = updatedMedianBuffer;
    this.movingAverageBuffer = updatedMovingAvgBuffer;
    this.smoothedValue = filteredValue;
    
    // Update baseline
    if (this.baseline === 0) {
      this.baseline = filteredValue;
    } else {
      this.baseline = this.baseline * this.BASELINE_FACTOR + filteredValue * (1 - this.BASELINE_FACTOR);
    }
    
    // Calculate derivative
    const derivative = filteredValue - this.lastValue;
    this.lastValue = filteredValue;
    
    // Find peaks
    const now = Date.now();
    const normalizedValue = filteredValue - this.baseline;
    
    // Detect peak
    const { isPeak, confidence } = detectPeak(
      normalizedValue,
      derivative,
      this.baseline,
      this.lastValue,
      this.lastPeakTime,
      now,
      {
        minPeakTimeMs: this.MIN_PEAK_TIME_MS,
        derivativeThreshold: this.DERIVATIVE_THRESHOLD,
        signalThreshold: this.SIGNAL_THRESHOLD
      }
    );
    
    // Confirm peak
    const { 
      isConfirmedPeak, 
      updatedBuffer, 
      updatedLastConfirmedPeak 
    } = confirmPeak(
      isPeak,
      normalizedValue,
      this.lastConfirmedPeak,
      this.peakConfirmationBuffer,
      this.MIN_CONFIDENCE,
      confidence
    );
    
    this.peakConfirmationBuffer = updatedBuffer;
    this.lastConfirmedPeak = updatedLastConfirmedPeak;
    
    // Process confirmed peak
    if (isConfirmedPeak) {
      this.previousPeakTime = this.lastPeakTime;
      this.lastPeakTime = now;
      
      // Update BPM history
      this.bpmHistory = updateBPMHistory(
        now,
        this.previousPeakTime,
        this.bpmHistory,
        {
          minBPM: this.MIN_BPM,
          maxBPM: this.MAX_BPM,
          maxHistoryLength: 12
        }
      );
      
      // Play beep if monitoring and not in warmup period
      if (this.isMonitoring && !this.isInWarmup()) {
        this.playBeep();
      }
    }
    
    // Calculate current BPM
    const rawBPM = calculateCurrentBPM(this.bpmHistory);
    
    // Apply smoothing
    this.smoothBPM = smoothBPM(rawBPM, this.smoothBPM, this.BPM_ALPHA);
    
    return {
      bpm: Math.round(this.smoothBPM),
      confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue,
      arrhythmiaCount: this.arrhythmiaCounter || 0,
      rrData: this.getRRIntervals()
    };
  }
  
  isInWarmup(): boolean {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }
  
  getRRIntervals(): { intervals: number[]; lastPeakTime: number | null } {
    if (this.bpmHistory.length < 2) {
      return {
        intervals: [],
        lastPeakTime: this.lastPeakTime
      };
    }
    
    // Calculate RR intervals
    const intervals = this.bpmHistory.map(bpm => Math.round(60000 / bpm));
    
    return {
      intervals,
      lastPeakTime: this.lastPeakTime
    };
  }
  
  getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
  
  reset(): void {
    // Reset all state variables
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
    this.startTime = Date.now();
    this.peakConfirmationBuffer = [];
    this.lastConfirmedPeak = false;
    this.smoothBPM = 0;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.lowSignalCount = 0;
    
    // Try to ensure audio context is active
    this.initAudio();
    
    console.log("HeartBeatProcessor: Reset complete - all values at zero");
  }
}
