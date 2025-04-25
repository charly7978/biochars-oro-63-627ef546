/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { HeartBeatConfig } from './heart-beat/config';
import { HeartbeatAudioManager } from './heart-beat/audio-manager';
import { ArrhythmiaDetectionService } from '@/services/ArrhythmiaDetectionService';
import { HeartBeatDetector } from './heart-beat/HeartBeatDetector';

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

  private detector: HeartBeatDetector;
  
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
    this.detector = new HeartBeatDetector();
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

  processSignal(value: number): {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number;
    arrhythmiaCount: number;
  } {
    if (!this.isMonitoring) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: 0,
        arrhythmiaCount: 0
      };
    }
    
    const result = this.detector.processValue(value);
    
    if (result.isPeak && result.confidence > 0.5) {
      this.updateBPM();
      if (this.isMonitoring && !this.isInWarmup()) {
        this.playBeep(result.confidence);
      }
    }
    
    return {
      bpm: Math.round(this.calculateCurrentBPM()),
      confidence: result.confidence,
      isPeak: result.isPeak,
      filteredValue: result.filteredValue,
      arrhythmiaCount: this.arrhythmiaCounter
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
  
  private updateBPM(): void {
    // Verificar si hay suficientes datos para calcular
    if (this.isInWarmup() || this.lastPeakTime === null || this.previousPeakTime === null) {
      return;
    }

    // Calcular el intervalo actual en ms entre los dos últimos picos
    const currentInterval = this.lastPeakTime - this.previousPeakTime;
    
    // Filtrar intervalos fisiológicamente improbables
    if (currentInterval < 250 || currentInterval > 1500) {
      return; // Ignorar intervalos fuera del rango fisiológico (40-240 BPM)
    }
    
    // Calcular el BPM instantáneo a partir del intervalo
    const instantBPM = 60000 / currentInterval;
    
    // Añadir al histórico para promediado
    this.bpmHistory.push(instantBPM);
    
    // Mantener solo los últimos 5 valores para un promedio móvil
    if (this.bpmHistory.length > 5) {
      this.bpmHistory.shift();
    }
    
    // Actualizar BPM suavizado usando promedio ponderado
    this.smoothBPM = this.getSmoothBPM();
  }

  private getSmoothBPM(): number {
    if (this.bpmHistory.length === 0) {
      return 75; // Valor por defecto si no hay datos
    }
    
    // Ordenar valores para identificar posibles outliers
    const sortedBPMs = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Si hay suficientes valores, descartar el más alto y el más bajo para reducir ruido
    let validBPMs = this.bpmHistory;
    if (sortedBPMs.length >= 5) {
      validBPMs = sortedBPMs.slice(1, -1); // Excluir valores extremos
    }
    
    // Calcular media de los valores válidos
    const sum = validBPMs.reduce((acc, val) => acc + val, 0);
    const averageBPM = sum / validBPMs.length;
    
    // Asegurar que está en rango fisiológico
    return Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, averageBPM));
  }

  private calculateCurrentBPM(): number {
    // Si no hay suficientes datos, usar valor suavizado actual
    if (this.bpmHistory.length < 2) {
      return this.smoothBPM > 0 ? this.smoothBPM : 75;
    }
    
    // Aplicar EMA al BPM actual (suaviza aún más los cambios)
    this.smoothBPM = this.smoothBPM * (1 - this.BPM_ALPHA) + 
                   this.getSmoothBPM() * this.BPM_ALPHA;
    
    // Asegurar valor fisiológico razonable
    return Math.max(this.MIN_BPM, Math.min(this.MAX_BPM, this.smoothBPM));
  }

  public getFinalBPM(): number {
    if (this.isInWarmup() || this.bpmHistory.length < 3) {
      // Durante el período de calentamiento, mostrar un valor promedio base
      return 75;
    }
    
    // Verificar si ha pasado demasiado tiempo desde el último pico
    const timeSinceLastPeak = this.lastPeakTime ? (Date.now() - this.lastPeakTime) : 0;
    
    // Si no hay picos recientes (>3 segundos), reducir gradualmente la confianza
    if (timeSinceLastPeak > 3000) {
      const degradationFactor = Math.min(1, 3000 / timeSinceLastPeak);
      return this.calculateCurrentBPM() * degradationFactor + 75 * (1 - degradationFactor);
    }
    
    return this.calculateCurrentBPM();
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
    this.detector.reset();
    
    console.log("HeartBeatProcessor: Reset complete - all values at zero");
  }
}
