/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { HeartBeatConfig } from './heart-beat/config';
import { medianFilter, calculateMovingAverage, calculateEMA } from './heart-beat/filters';
import { detectPeak, confirmPeak } from './heart-beat/peak-detector';
import { updateBPMHistory, calculateCurrentBPM, smoothBPM, calculateFinalBPM } from './heart-beat/bpm-calculator';
import { HeartbeatAudioManager } from './heart-beat/audio-manager';
import { checkSignalQuality, resetDetectionStates } from './heart-beat/signal-quality';

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
  lowSignalCount = 0;

  // Banderas para sincronización forzada
  FORCE_IMMEDIATE_BEEP = HeartBeatConfig.FORCE_IMMEDIATE_BEEP;
  SKIP_TIMING_VALIDATION = HeartBeatConfig.SKIP_TIMING_VALIDATION;

  signalBuffer = [];
  medianBuffer = [];
  movingAverageBuffer = [];
  smoothedValue = 0;
  audioContext = null;
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

  constructor() {
    this.audioManager = new HeartbeatAudioManager({
      primaryFrequency: this.BEEP_PRIMARY_FREQUENCY,
      secondaryFrequency: this.BEEP_SECONDARY_FREQUENCY,
      duration: this.BEEP_DURATION,
      volume: this.BEEP_VOLUME
    });
    this.startTime = Date.now();
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
    const filteredValue = calculateEMA(
      calculateMovingAverage(
        medianFilter(value, this.medianBuffer, this.MEDIAN_FILTER_WINDOW),
        this.movingAverageBuffer,
        this.MOVING_AVERAGE_WINDOW
      ),
      this.smoothedValue,
      this.EMA_ALPHA
    );
    
    // Update buffers
    if (this.medianBuffer.length > this.MEDIAN_FILTER_WINDOW) {
      this.medianBuffer.shift();
    }
    this.medianBuffer.push(value);
    
    if (this.movingAverageBuffer.length > this.MOVING_AVERAGE_WINDOW) {
      this.movingAverageBuffer.shift();
    }
    this.movingAverageBuffer.push(value);
    
    this.smoothedValue = filteredValue;

    // Actualizar línea base
    this.baseline =
      this.baseline * this.BASELINE_FACTOR + smoothedValue * (1 - this.BASELINE_FACTOR);

    // Normalize signal
    const normalizedValue = smoothedValue - this.baseline;
    this.autoResetIfSignalIsLow(Math.abs(normalizedValue));

    // Calcular derivada para detección de picos
    this.values.push(smoothedValue);
    if (this.values.length > 3) {
      this.values.shift();
    }

    let smoothDerivative = smoothedValue - this.lastValue;
    if (this.values.length === 3) {
      smoothDerivative = (this.values[2] - this.values[0]) / 2;
    }
    this.lastValue = smoothedValue;

    // Detect pico con umbral ajustado para mayor sensibilidad
    const now = Date.now();
    const { isPeak, confidence } = detectPeak(
      normalizedValue,
      smoothDerivative,
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

    // Confirm pico para evitar falsos positivos
    const { isConfirmedPeak, updatedBuffer, updatedLastConfirmedPeak } = confirmPeak(
      isPeak,
      normalizedValue,
      this.lastConfirmedPeak,
      this.peakConfirmationBuffer,
      this.MIN_CONFIDENCE,
      confidence
    );

    this.peakConfirmationBuffer = updatedBuffer;
    this.lastConfirmedPeak = updatedLastConfirmedPeak;

    // Procesar pico confirmado con reproducción inmediata de beep
    if (isConfirmedPeak) {
      this.previousPeakTime = this.lastPeakTime;
      this.lastPeakTime = now;

      // Actualizar BPM
      const interval = this.lastPeakTime - this.previousPeakTime;
      if (interval > 0) {
        const instantBPM = 60000 / interval;
        if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
          this.bpmHistory.push(instantBPM);
          if (this.bpmHistory.length > 12) {
            this.bpmHistory.shift();
          }
        }
      }

      // Play beep if monitoring and not in warmup period
      if (this.isMonitoring && !this.isInWarmup()) {
        this.playBeep();
      }
    }

    // Calcular BPM
    let rawBPM = 0;
    if (this.bpmHistory.length >= 2) {
      const sorted = [...this.bpmHistory].sort((a, b) => a - b);
      const trimmed = sorted.slice(1, -1);
      if (trimmed.length) {
        rawBPM = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      }
    }

    // Apply smoothing
    if (this.smoothBPM === 0) {
      this.smoothBPM = rawBPM;
    } else {
      this.smoothBPM = this.BPM_ALPHA * rawBPM + (1 - this.BPM_ALPHA) * this.smoothBPM;
    }

    // Return results
    return {
      bpm: Math.round(this.smoothBPM),
      confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue: smoothedValue,
      arrhythmiaCount: this.arrhythmiaCounter || 0
    };
  }

  autoResetIfSignalIsLow(amplitude) {
    if (amplitude < this.LOW_SIGNAL_THRESHOLD) {
      this.lowSignalCount++;
      if (this.lowSignalCount >= this.LOW_SIGNAL_FRAMES) {
        this.resetDetectionStates();
      }
    } else {
      this.lowSignalCount = 0;
    }
  }

  resetDetectionStates() {
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastConfirmedPeak = false;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.peakConfirmationBuffer = [];
    this.values = [];
    resetDetectionStates(); // Call the imported function
    console.log("HeartBeatProcessor: auto-reset detection states (low signal).");
  }

  getFinalBPM() {
    if (this.bpmHistory.length < 5) {
      return 0;
    }
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    const cut = Math.round(sorted.length * 0.1);
    const finalSet = sorted.slice(cut, sorted.length - cut);
    if (!finalSet.length) return 0;
    const sum = finalSet.reduce((acc, val) => acc + val, 0) / finalSet.length;
    return Math.round(sum / finalSet.length);
  }

  reset() {
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
    
    // Intentar asegurar que el contexto de audio esté activo
    if (this.audioContext && this.audioContext.state !== 'running') {
      this.audioContext.resume().catch(err => {
        console.error("HeartBeatProcessor: Error resuming audio context during reset", err);
      });
    }
  }

  getArrhythmiaCounter() {
    return this.arrhythmiaCounter || 0;
  }

  getRRIntervals() {
    return {
      intervals: [...this.bpmHistory],
      lastPeakTime: this.lastPeakTime
    };
  }
}
