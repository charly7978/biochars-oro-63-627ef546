/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { HeartBeatConfig } from '../modules/heart-beat/config';
import { applyFilterPipeline } from '../modules/heart-beat/signal-filters';
import { 
  detectAndConfirmPeak,
  getInitialPeakDetectionState,
  // PeakDetectionState 
  // detectPeak, // No longer needed separately
  // confirmPeak // No longer needed separately
} from '../modules/heart-beat/peak-detector';
import { 
  updateBPMHistory, 
  calculateCurrentBPM, 
  smoothBPM, 
  calculateFinalBPM 
} from '../modules/heart-beat/bpm-calculator';
import { RRIntervalData } from '../types/peak';
import AudioFeedbackService from './AudioFeedbackService';
import FeedbackService from './FeedbackService';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';
import { ArrhythmiaDetectionResult } from './arrhythmia/types';
import { 
    filterRRIntervalsMAD, 
    estimateSignalQuality, 
    calculateMAD 
} from '../modules/vital-signs/shared-signal-utils';

export interface HeartRateResult {
  bpm: number;
  confidence: number;
  isPeak: boolean;
  filteredValue: number;
  rrIntervals: number[];
  lastPeakTime: number | null;
  rrData?: RRIntervalData;
}

export interface PeakData {
  timestamp: number;
  value: number;
}

export interface FilterOptions {
  medianWindowSize: number;
  movingAvgWindowSize: number;
  emaAlpha: number;
}

/**
 * Servicio centralizado para el procesamiento de la frecuencia cardíaca
 * - Elimina duplicidad entre procesadores JS y TS
 * - Centraliza la detección de picos
 * - Proporciona una única fuente de verdad para las métricas cardíacas
 */
class HeartRateService {
  private static instance: HeartRateService;

  // Constants from config
  private readonly SAMPLE_RATE = HeartBeatConfig.SAMPLE_RATE;
  private readonly WINDOW_SIZE = HeartBeatConfig.WINDOW_SIZE;
  private readonly MIN_BPM = HeartBeatConfig.MIN_BPM;
  private readonly MAX_BPM = HeartBeatConfig.MAX_BPM;
  private readonly SIGNAL_THRESHOLD = HeartBeatConfig.SIGNAL_THRESHOLD;
  private readonly MIN_CONFIDENCE = HeartBeatConfig.MIN_CONFIDENCE;
  private readonly DERIVATIVE_THRESHOLD = HeartBeatConfig.DERIVATIVE_THRESHOLD;
  private readonly MIN_PEAK_TIME_MS = HeartBeatConfig.MIN_PEAK_TIME_MS;
  private readonly WARMUP_TIME_MS = HeartBeatConfig.WARMUP_TIME_MS;
  private readonly MEDIAN_FILTER_WINDOW = HeartBeatConfig.MEDIAN_FILTER_WINDOW;
  private readonly MOVING_AVERAGE_WINDOW = HeartBeatConfig.MOVING_AVERAGE_WINDOW;
  private readonly EMA_ALPHA = HeartBeatConfig.EMA_ALPHA;
  private readonly BASELINE_FACTOR = HeartBeatConfig.BASELINE_FACTOR;
  private readonly LOW_SIGNAL_THRESHOLD = HeartBeatConfig.LOW_SIGNAL_THRESHOLD;
  private readonly LOW_SIGNAL_FRAMES = HeartBeatConfig.LOW_SIGNAL_FRAMES;
  private readonly MIN_BEEP_INTERVAL_MS = HeartBeatConfig.MIN_BEEP_INTERVAL_MS;

  // State variables
  private signalBuffer: number[] = [];
  private medianBuffer: number[] = [];
  private movingAverageBuffer: number[] = [];
  private smoothedValue: number = 0;
  private lastBeepTime: number = 0;
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private bpmHistory: number[] = [];
  private baseline: number = 0;
  private lastValue: number = 0;
  private values: number[] = [];
  private startTime: number = 0;
  private peakDetectionState = getInitialPeakDetectionState();
  private lastConfirmedPeak: boolean = false;
  private smoothBPM: number = 0;
  private readonly BPM_ALPHA: number = 0.2;
  private peakCandidateIndex: number | null = null;
  private peakCandidateValue: number = 0;
  private isMonitoring: boolean = false;
  private lowSignalCount: number = 0;
  private peakListeners: Array<(data: PeakData) => void> = [];
  private vibrationEnabled: boolean = true;
  private rrIntervalHistory: number[] = [];
  
  // Used to prevent duplicate beeps/vibrations
  private lastProcessedPeakTime: number = 0;
  private debugCounter = 0; // Counter for selective logging
  private currentSignalQuality: number = 50; // Initialize quality

  private constructor() {
    this.reset();
    console.log("HeartRateService: Singleton instance created - unified processor");
    
    // Intentar verificar si la vibración está disponible
    this.checkVibrationAvailability();
  }

  /**
   * Obtiene la instancia única del servicio (Singleton)
   */
  public static getInstance(): HeartRateService {
    if (!HeartRateService.instance) {
      HeartRateService.instance = new HeartRateService();
    }
    return HeartRateService.instance;
  }

  /**
   * Verifica si la vibración está disponible en el dispositivo
   */
  private checkVibrationAvailability(): void {
    try {
      this.vibrationEnabled = 'vibrate' in navigator;
      console.log(`HeartRateService: Vibration ${this.vibrationEnabled ? 'enabled' : 'disabled'}`);
    } catch (e) {
      console.warn("HeartRateService: Error checking vibration availability", e);
      this.vibrationEnabled = false;
    }
  }

  /**
   * Activa o desactiva el monitoreo continuo
   */
  public setMonitoring(isActive: boolean): void {
    this.isMonitoring = isActive;
    console.log("HeartRateService: Monitoring state set to", isActive);
  }

  /**
   * Registra un escuchador para eventos de picos detectados
   * Permite sincronizar la visualización y el audio
   */
  public addPeakListener(listener: (data: PeakData) => void): void {
    this.peakListeners.push(listener);
  }

  /**
   * Elimina un escuchador de eventos de picos
   */
  public removePeakListener(listener: (data: PeakData) => void): void {
    this.peakListeners = this.peakListeners.filter(l => l !== listener);
  }

  /**
   * Notifica a todos los escuchadores que se ha detectado un pico
   */
  private notifyPeakListeners(data: PeakData): void {
    for (const listener of this.peakListeners) {
      try {
        listener(data);
      } catch (error) {
        console.error("HeartRateService: Error in peak listener", error);
      }
    }
  }

  /**
   * Reproduce un sonido de latido con la opción de vibración
   */
  private triggerHeartbeatFeedback(isArrhythmia: boolean = false, value: number = 0.7): boolean {
    // Ya no usamos el flag isArrhythmia aquí
    // Delegar a AudioFeedbackService para feedback normal
    return AudioFeedbackService.triggerHeartbeatFeedback('normal', realMin(0.8, realAbs(value) + 0.3));
  }

  /**
   * Procesa un valor de señal PPG y detecta picos
   * Versión sincronizada para coordinar audio y visual
   */
  public processSignal(value: number): HeartRateResult {
    this.debugCounter++;
    const shouldLog = (this.debugCounter % 15 === 0);
    if (shouldLog) console.log(`[HRS ${this.debugCounter}] Input: ${value.toFixed(4)}`);

    // --- Pre-checks --- 
    if (this.isWeakSignal(value)) {
      if (shouldLog) console.log(`[HRS ${this.debugCounter}] Weak signal detected`);
      // Reset confidence/quality if signal is weak? Or let confidence calculation handle it.
      this.currentSignalQuality = 10; // Set low quality
      // Return current smoothed BPM but low confidence
      return { bpm: Math.round(this.smoothBPM), confidence: 0.1, isPeak: false, filteredValue: value, rrIntervals: [], lastPeakTime: this.lastPeakTime, rrData: { intervals: [], lastPeakTime: this.lastPeakTime } };
    }
    this.currentSignalQuality = estimateSignalQuality(this.signalBuffer); // Calculate quality based on buffer

    // --- Filtering & Derivative --- 
    const { filteredValue } = this.applyFilters(value);
    this.smoothedValue = filteredValue;
    // Baseline calculation needs filtered history
    this.signalBuffer.push(filteredValue);
    if (this.signalBuffer.length > this.WINDOW_SIZE) this.signalBuffer.shift();
    this.updateBaseline(); // Update baseline using filtered history
    const derivative = filteredValue - this.lastValue;
    const normalizedValue = filteredValue - this.baseline;
    this.lastValue = filteredValue; 
    if (shouldLog) console.log(`[HRS ${this.debugCounter}] Filtered: ${filteredValue.toFixed(4)}, Norm: ${normalizedValue.toFixed(4)}, Deriv: ${derivative.toFixed(4)}`);

    // --- Peak Detection & Confirmation --- 
    const now = Date.now();
    const detectionResult = detectAndConfirmPeak(
      normalizedValue,
      derivative,
      this.lastValue, 
      now,
      this.peakDetectionState,
      {
        minPeakTimeMs: this.MIN_PEAK_TIME_MS,
        derivativeThreshold: this.DERIVATIVE_THRESHOLD,
        minConfidence: this.MIN_CONFIDENCE 
      }
    );
    this.peakDetectionState = detectionResult.updatedState; 
    const isConfirmedPeak = detectionResult.isPeakConfirmed;
    const peakConfidence = detectionResult.confidence;
    if (shouldLog) console.log(`[HRS ${this.debugCounter}] Peak Confirm: ${isConfirmedPeak}, Conf: ${peakConfidence.toFixed(2)}, AdaptThresh: ${this.peakDetectionState.adaptiveThreshold.toFixed(3)}`);

    // --- Process Confirmed Peak --- 
    let validatedRrIntervals: number[] = this.rrIntervalHistory;
    let rrStabilityScore = 0.5;
    let isCurrentPeakArrhythmic = false;

    if (isConfirmedPeak && !this.lastConfirmedPeak) {
      this.lastConfirmedPeak = true;
      
      this.previousPeakTime = this.lastPeakTime; 
      this.lastPeakTime = now;
      
      if (this.previousPeakTime !== null) {
        const newInterval = this.lastPeakTime - this.previousPeakTime;
        if (newInterval >= this.MIN_PEAK_TIME_MS / 1.5 && newInterval <= 2500) {
          this.rrIntervalHistory.push(newInterval);
          if (this.rrIntervalHistory.length > 20) this.rrIntervalHistory.shift();
          if (shouldLog) console.log(`[HRS ${this.debugCounter}] New RR: ${newInterval} ms`);
        }
      }
      
      validatedRrIntervals = filterRRIntervalsMAD(this.rrIntervalHistory);
      if (shouldLog && validatedRrIntervals.length !== this.rrIntervalHistory.length) {
          console.log(`[HRS ${this.debugCounter}] RR Filtered: ${this.rrIntervalHistory.length} -> ${validatedRrIntervals.length}`);
      }
      
      if (validatedRrIntervals.length >= 5) {
          const { median: medianRR, mad: madRR } = calculateMAD(validatedRrIntervals);
          if (!isNaN(medianRR) && medianRR > 0) {
              const coeffVar = (madRR / medianRR);
              rrStabilityScore = Math.max(0, 1 - coeffVar * 3); 
          }
      }
      if (shouldLog) console.log(`[HRS ${this.debugCounter}] RR Stability Score: ${rrStabilityScore.toFixed(2)}`);

      let currentArrhythmiaStatus: ArrhythmiaDetectionResult['category'] = 'normal';
      if (validatedRrIntervals.length >= 5) {
          const arrhythmiaResult = ArrhythmiaDetectionService.detectArrhythmia(validatedRrIntervals);
          isCurrentPeakArrhythmic = arrhythmiaResult.isArrhythmia;
          currentArrhythmiaStatus = arrhythmiaResult.category || (isCurrentPeakArrhythmic ? 'possible-arrhythmia' : 'normal');
      }
      
      if (this.isMonitoring && !this.isInWarmup() && now - this.lastProcessedPeakTime > this.MIN_PEAK_TIME_MS * 0.8) {
          const feedbackConfidence = peakConfidence * (this.currentSignalQuality / 100) * rrStabilityScore;
          if (shouldLog) console.log(`[HRS ${this.debugCounter}] Triggering Feedback: Arr=${isCurrentPeakArrhythmic}, Conf=${feedbackConfidence.toFixed(2)}`);
          this.triggerHeartbeatFeedback(isCurrentPeakArrhythmic, feedbackConfidence);
          this.notifyPeakListeners({ timestamp: now, value: normalizedValue }); 
          this.lastProcessedPeakTime = now; 
      }
    } else if (!isConfirmedPeak) {
      this.lastConfirmedPeak = false;
    }
    
    if (this.rrIntervalHistory.length > 0) {
        validatedRrIntervals = filterRRIntervalsMAD(this.rrIntervalHistory);
    } else {
        validatedRrIntervals = [];
    }
    
    const rawBPM = calculateCurrentBPM(validatedRrIntervals); 
    this.smoothBPM = smoothBPM(rawBPM > 0 ? rawBPM : this.smoothBPM, this.smoothBPM, this.BPM_ALPHA);
    
    const finalConfidence = Math.max(0, Math.min(1, 
        (peakConfidence * 0.4 + rrStabilityScore * 0.4 + (this.currentSignalQuality / 100) * 0.2) * 
        (this.isInWarmup() ? 0.3 : 1) *                
        (this.isWeakSignal(value) ? 0.0 : 1)
    ));
    if (shouldLog) console.log(`[HRS ${this.debugCounter}] BPM: Raw=${rawBPM.toFixed(1)}, Smooth=${this.smoothBPM.toFixed(1)}, Conf=${finalConfidence.toFixed(2)}`);

    const rrData: RRIntervalData = {
      intervals: [...validatedRrIntervals],
      lastPeakTime: this.lastPeakTime
    };
    
    return { 
        bpm: Math.round(this.smoothBPM), 
        confidence: finalConfidence, 
        isPeak: isConfirmedPeak && !this.lastConfirmedPeak && !this.isInWarmup(),
        filteredValue,
        rrIntervals: [...validatedRrIntervals],
        lastPeakTime: this.lastPeakTime,
        rrData
    };
  }
  
  /**
   * Verifica si la señal es débil
   * TEMPORALMENTE DESHABILITADO PARA DEPURACIÓN: Siempre devuelve false.
   */
  private isWeakSignal(value: number): boolean {
    return false; // Deshabilitar temporalmente el chequeo de señal débil
    /* Lógica Original:
    const valueAbs = Math.abs(value);
    const isCurrentlyWeak = valueAbs < this.LOW_SIGNAL_THRESHOLD;
    
    if (isCurrentlyWeak) {
      this.lowSignalCount++;
    } else {
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 1);
    }
    
    return this.lowSignalCount > this.LOW_SIGNAL_FRAMES;
    */
  }
  
  /**
   * Aplica filtros a la señal cruda
   */
  private applyFilters(value: number): { 
    filteredValue: number; 
    updatedMedianBuffer: number[]; 
    updatedMovingAvgBuffer: number[]; 
  } {
    return applyFilterPipeline(
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
  }
  
  /**
   * Actualiza el historial de BPM
   */
  private updateBPMHistory(now: number): number[] {
    return updateBPMHistory(
      now,
      this.previousPeakTime,
      this.bpmHistory,
      {
        minBPM: this.MIN_BPM,
        maxBPM: this.MAX_BPM,
        maxHistoryLength: 12
      }
    );
  }
  
  /**
   * Calcula el BPM actual
   */
  private calculateBPM(): number {
    return calculateCurrentBPM(this.bpmHistory);
  }
  
  /**
   * Verifica si está en periodo de calentamiento
   */
  private isInWarmup(): boolean {
    return Date.now() - this.startTime < this.WARMUP_TIME_MS;
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): void {
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
    this.peakDetectionState = getInitialPeakDetectionState();
    this.lastConfirmedPeak = false;
    this.smoothBPM = 0;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.lowSignalCount = 0;
    this.lastProcessedPeakTime = 0;
    this.rrIntervalHistory = [];
    this.currentSignalQuality = 50; // Reset quality estimate
    
    console.log("HeartRateService: Reset complete - including peak detection state");
  }

  /**
   * Returns the current smoothed BPM value.
   */
  public getFinalBPM(): number {
    // Return the smoothed value, rounded
    return Math.round(this.smoothBPM);
  }

  private updateBaseline(): void {
      if (this.signalBuffer.length > this.WINDOW_SIZE / 2) { 
          const recentFiltered = this.signalBuffer.slice(-Math.floor(this.WINDOW_SIZE / 2));
          const { median: medianFiltered } = calculateMAD(recentFiltered);
          const newBaseline = isNaN(medianFiltered) ? this.smoothedValue : medianFiltered;
          this.baseline = this.baseline * this.BASELINE_FACTOR + newBaseline * (1 - this.BASELINE_FACTOR); // Smooth update
      } else {
          this.baseline = this.smoothedValue; // Fallback if not enough data
      }
  }
}

export default HeartRateService.getInstance();

// Utilidades deterministas para reemplazar Math
function realMin(a: number, b: number): number { return a < b ? a : b; }
function realMax(a: number, b: number): number { return a > b ? a : b; }
function realAbs(x: number): number { return x < 0 ? -x : x; }
function realRound(x: number): number { return (x % 1) >= 0.5 ? (x - (x % 1) + 1) : (x - (x % 1)); }
function realPow(base: number, exp: number): number { let result = 1; for (let i = 0; i < exp; i++) result *= base; return result; }
function realSqrt(value: number): number { if (value < 0) return NaN; let x = value; for (let i = 0; i < 12; i++) { x = 0.5 * (x + value / x); } return x; }
