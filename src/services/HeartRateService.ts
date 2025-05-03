/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { HeartBeatConfig } from '../modules/heart-beat/config';
import { applyFilterPipeline } from '../modules/heart-beat/signal-filters';
import { detectPeak, confirmPeak } from '../modules/heart-beat/peak-detector';
import { 
  updateBPMHistory, 
  calculateCurrentBPM, 
  smoothBPM, 
  calculateFinalBPM 
} from '../modules/heart-beat/bpm-calculator';
import { RRIntervalData } from '../types/peak';
import AudioFeedbackService from './AudioFeedbackService';
import FeedbackService from './FeedbackService';

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
  private peakConfirmationBuffer: number[] = [];
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
    const shouldLog = (this.debugCounter % 15 === 0); // Log roughly every half second

    if (shouldLog) console.log(`[HRS ${this.debugCounter}] Input ppgValue: ${value.toFixed(4)}`);

    // Weak signal check
    if (this.isWeakSignal(value)) {
      return {
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: value,
        rrIntervals: [],
        lastPeakTime: this.lastPeakTime,
        rrData: {
          intervals: [],
          lastPeakTime: this.lastPeakTime
        }
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
    } = this.applyFilters(value);
    this.medianBuffer = updatedMedianBuffer;
    this.movingAverageBuffer = updatedMovingAvgBuffer;
    this.smoothedValue = filteredValue;
    if (shouldLog) console.log(`[HRS ${this.debugCounter}] Filtered Value: ${filteredValue.toFixed(4)}`);
    
    // Update baseline
    if (this.baseline === 0) {
      this.baseline = filteredValue;
    } else {
      this.baseline = this.baseline * this.BASELINE_FACTOR + filteredValue * (1 - this.BASELINE_FACTOR);
    }
    
    // Calculate derivative
    const derivative = filteredValue - this.lastValue;
    this.lastValue = filteredValue;
    if (shouldLog) console.log(`[HRS ${this.debugCounter}] Normalized: ${derivative.toFixed(4)}, Baseline: ${this.baseline.toFixed(4)}`);
    
    // Find peaks
    const now = Date.now();
    const normalizedValue = filteredValue - this.baseline;
    
    // Detect peak
    const { isPeak, confidence } = this.detectPeak(
      normalizedValue,
      derivative,
      now
    );
    
    // Confirm peak
    const { 
      isConfirmedPeak, 
      updatedBuffer, 
      updatedLastConfirmedPeak 
    } = this.confirmPeak(
      isPeak,
      normalizedValue,
      confidence
    );
    
    this.peakConfirmationBuffer = updatedBuffer;
    this.lastConfirmedPeak = updatedLastConfirmedPeak;
    
    // Process confirmed peak
    if (isConfirmedPeak) {
      this.previousPeakTime = this.lastPeakTime;
      this.lastPeakTime = now;
      
      if (this.previousPeakTime !== null) {
        const newInterval = this.lastPeakTime - this.previousPeakTime;
        if (newInterval >= this.MIN_PEAK_TIME_MS && newInterval <= 2000) {
          this.rrIntervalHistory.push(newInterval);
          if (this.rrIntervalHistory.length > 20) {
            this.rrIntervalHistory.shift();
          }
          if (shouldLog) console.log(`[HRS ${this.debugCounter}] New RR Interval: ${newInterval} ms`);
        }
      }

      // Update BPM history
      this.bpmHistory = this.updateBPMHistory(now);
      
      // Trigger vibration and beep (ya no diferencia arritmia)
      this.triggerHeartbeatFeedback(false, confidence); // Siempre feedback normal
      
      // Notify listeners about the peak (solo timestamp y valor)
      this.notifyPeakListeners({
        timestamp: now, 
        value: filteredValue // Usar valor filtrado 
      });
    }
    
    // Calculate current BPM
    const rawBPM = this.calculateBPM();
    
    // Apply smoothing
    this.smoothBPM = this.smoothBPM * (1 - this.BPM_ALPHA) + rawBPM * this.BPM_ALPHA;
    
    // Create RRIntervalData object con el historial actualizado
    const rrData: RRIntervalData = {
      intervals: [...this.rrIntervalHistory],
      lastPeakTime: this.lastPeakTime
    };
    
    return {
      bpm: realRound(this.smoothBPM),
      confidence,
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue,
      rrIntervals: [...this.rrIntervalHistory],
      lastPeakTime: this.lastPeakTime,
      rrData
    };
  }
  
  /**
   * Verifica si la señal es débil
   */
  private isWeakSignal(value: number): boolean {
    const valueAbs = value >= 0 ? value : -value;
    const isCurrentlyWeak = valueAbs < this.LOW_SIGNAL_THRESHOLD;
    
    if (isCurrentlyWeak) {
      this.lowSignalCount++;
    } else {
      this.lowSignalCount = realMax(0, this.lowSignalCount - 1);
    }
    
    return this.lowSignalCount > this.LOW_SIGNAL_FRAMES;
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
   * Detecta si hay un pico en la señal
   */
  private detectPeak(
    normalizedValue: number,
    derivative: number,
    currentTime: number
  ): { isPeak: boolean; confidence: number } {
    return detectPeak(
      normalizedValue,
      derivative,
      this.baseline,
      this.lastValue,
      this.lastPeakTime,
      currentTime,
      {
        minPeakTimeMs: this.MIN_PEAK_TIME_MS,
        derivativeThreshold: this.DERIVATIVE_THRESHOLD,
        signalThreshold: this.SIGNAL_THRESHOLD
      }
    );
  }
  
  /**
   * Confirma si un pico potencial es real
   */
  private confirmPeak(
    isPeak: boolean,
    normalizedValue: number,
    confidence: number
  ): {
    isConfirmedPeak: boolean;
    updatedBuffer: number[];
    updatedLastConfirmedPeak: boolean;
  } {
    return confirmPeak(
      isPeak,
      normalizedValue,
      this.lastConfirmedPeak,
      this.peakConfirmationBuffer,
      this.MIN_CONFIDENCE,
      confidence
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
    this.peakConfirmationBuffer = [];
    this.lastConfirmedPeak = false;
    this.smoothBPM = 0;
    this.peakCandidateIndex = null;
    this.peakCandidateValue = 0;
    this.lowSignalCount = 0;
    this.lastProcessedPeakTime = 0;
    this.rrIntervalHistory = [];
    
    console.log("HeartRateService: Reset complete - including peak detection states");
  }

  /**
   * Returns the current smoothed BPM value.
   */
  public getFinalBPM(): number {
    // Return the smoothed value, rounded
    return Math.round(this.smoothBPM);
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
