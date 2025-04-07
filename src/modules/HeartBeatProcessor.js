
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { HeartBeatConfig } from './heart-beat/config';
import { applyFilterPipeline } from './heart-beat/signal-filters';
import { detectPeak, confirmPeak } from './heart-beat/peak-detector';
import { updateBPMHistory, calculateCurrentBPM, smoothBPM, calculateFinalBPM } from './heart-beat/bpm-calculator';
import { HeartbeatAudioManager } from './heart-beat/audio-manager';
import { checkSignalQuality } from './heart-beat/signal-quality';

// Definición local de resetDetectionStates como fallback en caso de fallo de importación
const resetDetectionStatesLocal = () => {
  console.log("Signal quality: Resetting detection states (local fallback)");
  return {
    weakSignalsCount: 0
  };
};

// Intentar importar resetDetectionStates o usar el fallback si falla
let resetDetectionStates = resetDetectionStatesLocal;

// Esta es una forma segura de manejar dependencias críticas
try {
  // Comprobar si existe importación global (provista por el sistema de defensa)
  if (typeof window !== 'undefined' && 
      window.__moduleResolution && 
      window.__moduleResolution['/src/modules/heart-beat/signal-quality.ts'] &&
      window.__moduleResolution['/src/modules/heart-beat/signal-quality.ts'].resetDetectionStates) {
    
    resetDetectionStates = window.__moduleResolution['/src/modules/heart-beat/signal-quality.ts'].resetDetectionStates;
    console.log("HeartBeatProcessor: Using resetDetectionStates from global module resolution");
  }
} catch (error) {
  console.error("HeartBeatProcessor: Error resolving resetDetectionStates, using local fallback", error);
  resetDetectionStates = resetDetectionStatesLocal;
}

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
  signalBuffer = [];
  medianBuffer = [];
  movingAverageBuffer = [];
  smoothedValue = 0;
  lastBeepTime = 0;
  lastPeakTime = null;
  previousPeakTime = null;
  bpmHistory = [];
  baseline = 0;
  lastValue = 0;
  values = [];
  startTime = 0;
  peakConfirmationBuffer = [];
  lastConfirmedPeak = false;
  smoothBPM = 0;
  BPM_ALPHA = 0.2;
  peakCandidateIndex = null;
  peakCandidateValue = 0;
  isMonitoring = false;
  arrhythmiaCounter = 0;
  lowSignalCount = 0;

  // Audio manager
  audioManager = null;

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

  async initAudio() {
    try {
      await this.audioManager.initAudio();
    } catch (err) {
      console.error("HeartBeatProcessor: Error initializing audio", err);
    }
  }

  async playBeep(volume = 0.7) {
    // Don't play beeps if not monitoring
    if (!this.isMonitoring) {
      console.log("HeartBeatProcessor: Beep requested but monitoring is off");
      return false;
    }
    
    try {
      return await this.audioManager.playBeep(volume);
    } catch (error) {
      console.error("HeartBeatProcessor: Error playing beep", error);
      return false;
    }
  }
  
  setMonitoring(isActive) {
    this.isMonitoring = isActive;
    console.log("HeartBeatProcessor: Monitoring state set to", isActive);
  }

  processSignal(value) {
    // Check for weak signal - using imported function with fallbacks
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
      arrhythmiaCount: this.arrhythmiaCounter || 0
    };
  }
  
  isInWarmup() {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }
  
  getRRIntervals() {
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
  
  getArrhythmiaCounter() {
    return this.arrhythmiaCounter;
  }
  
  reset() {
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
    
    // Reset signal quality states - use safe resetDetectionStates
    // that handles missing imports
    try {
      resetDetectionStates();
    } catch (error) {
      console.error("HeartBeatProcessor: Error calling resetDetectionStates, using fallback", error);
      resetDetectionStatesLocal();
    }
    
    console.log("HeartBeatProcessor: Reset complete - all values at zero");
  }
}
