/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { HeartBeatConfig } from '../modules/heart-beat/config';
import { applyFilterPipeline } from '../modules/heart-beat/signal-filters';
import { 
  detectPeak, 
  confirmPeak,
  getInitialPeakDetectionState,
  getInitialPeakConfirmationState,
  // Assuming PeakDetectionState and PeakConfirmationState types are exported from peak-detector too
  // If not, they should be defined here or in a shared types file.
  // PeakDetectionState, PeakConfirmationState 
} from '../modules/heart-beat/peak-detector';
import { 
  updateBPMHistory, 
  calculateCurrentBPM, 
  smoothBPM, 
  calculateFinalBPM 
} from '../modules/heart-beat/bpm-calculator';
import { PeakData, RRIntervalData } from '../types/peak';
import AudioFeedbackService from './AudioFeedbackService';
import FeedbackService from './FeedbackService';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';
import { ArrhythmiaDetectionResult } from './arrhythmia/types';
import { 
    estimateSignalQuality,
    filterRRIntervalsMAD,
    calculateMAD // If needed directly elsewhere
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

export interface PeakDetectionOptions {
  minPeakTimeMs: number;
  derivativeThreshold: number;
  signalThreshold: number;
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

  // Add state properties for peak detection
  private peakDetectionState = getInitialPeakDetectionState();
  private peakConfirmationState = getInitialPeakConfirmationState();
  private readonly signalWindowSizeForConfirmation = 11; // e.g., 5 points before, current, 5 points after

  // Add state for signal quality
  private currentSignalQuality: number = 0;

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
    const now = Date.now();
    
    // Evitar reproducción de beeps demasiado seguidos
    if (now - this.lastBeepTime < this.MIN_BEEP_INTERVAL_MS) {
      return false;
    }
    
    // Actualizar tiempo del último beep
    this.lastBeepTime = now;
    
    // Crear datos del pico para audio
    const peakData: PeakData = {
      timestamp: now,
      value,
      isArrhythmia
    };
    
    // Reproducir audio
    AudioFeedbackService.queuePeak(peakData);
    
    // Activar vibración si está disponible
    if (this.vibrationEnabled) {
      try {
        if (isArrhythmia) {
          FeedbackService.vibrateArrhythmia();
        } else {
          FeedbackService.vibrate(80); // Vibración corta para pulso normal
        }
      } catch (error) {
        console.error("HeartRateService: Error during vibration", error);
      }
    }
    
    return true;
  }

  /**
   * Procesa un valor de señal PPG y detecta picos
   * Versión sincronizada para coordinar audio y visual
   */
  public processSignal(value: number): HeartRateResult {
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
    
    // Update signal buffer (using raw value for now)
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.WINDOW_SIZE) {
      this.signalBuffer.shift();
    }

    // Apply filters
    const { filteredValue /*, ... */ } = this.applyFilters(value);
    this.smoothedValue = filteredValue; // Keep track of the filtered value
    
    // Estimate Signal Quality using the filtered signal buffer
    this.currentSignalQuality = estimateSignalQuality(this.signalBuffer.map(v => v - this.baseline), HeartBeatConfig.SIGNAL_THRESHOLD * 0.3 ); // Use filtered, baseline-removed signal

    // Recalculate baseline based on filtered signal
    if (this.signalBuffer.length > this.WINDOW_SIZE / 2) { 
        const recentFiltered = this.signalBuffer.slice(-Math.floor(this.WINDOW_SIZE / 2));
        const { median: medianFiltered } = calculateMAD(recentFiltered);
        this.baseline = isNaN(medianFiltered) ? this.smoothedValue : medianFiltered;
    } else {
        this.baseline = this.smoothedValue; // Fallback if not enough data
    }
    
    // Calculate derivative based on filtered signal
    const derivative = filteredValue - this.lastValue;
    this.lastValue = filteredValue; // Update lastValue with filtered one
    
    // Normalize using filtered value and baseline
    const normalizedValue = filteredValue - this.baseline;
    
    // Detect peak candidate
    const detectionResult = detectPeak(
      normalizedValue,
      derivative,
      this.lastValue, // Pass previous normalized value
      Date.now(),
      this.peakDetectionState, // Pass current state
      {
        minPeakTimeMs: this.MIN_PEAK_TIME_MS,
        derivativeThreshold: this.DERIVATIVE_THRESHOLD,
      }
    );
    this.peakDetectionState = detectionResult.updatedState; // Update state
    const isPeakCandidate = detectionResult.isPeakCandidate;
    const peakConfidence = detectionResult.confidence;
    
    // Confirm peak
    const confirmationWindow = this.signalBuffer.slice(-(this.signalWindowSizeForConfirmation)); // Use filtered buffer for confirmation window
    const confirmationResult = confirmPeak(
      isPeakCandidate,
      normalizedValue,
      peakConfidence, // Use confidence from detectPeak
      confirmationWindow, // Pass signal window
      this.peakConfirmationState, // Pass current confirmation state
      this.MIN_CONFIDENCE,
      this.peakDetectionState.adaptiveThreshold // Pass the updated adaptive threshold
    );
    this.peakConfirmationState = confirmationResult.updatedState; // Update state
    const isConfirmedPeak = confirmationResult.isConfirmedPeak;
    
    let validatedRrIntervals: number[] = []; // Store validated intervals
    let rrStabilityScore = 0; // Score based on interval consistency

    if (isConfirmedPeak) {
      // Update lastPeakTime inside the state as well for refractory period check
      this.peakDetectionState.lastPeakTime = Date.now();
      
      this.previousPeakTime = this.lastPeakTime; // Keep track for RR interval
      this.lastPeakTime = Date.now(); // Update service-level lastPeakTime used elsewhere
      
      if (this.previousPeakTime !== null) {
        const newInterval = this.lastPeakTime - this.previousPeakTime;
        if (newInterval >= this.MIN_PEAK_TIME_MS && newInterval <= 2000) {
          this.rrIntervalHistory.push(newInterval);
          if (this.rrIntervalHistory.length > 20) {
            this.rrIntervalHistory.shift();
          }
        }
      }

      // Update BPM history
      this.bpmHistory = this.updateBPMHistory(Date.now());
      
      // Validate RR intervals using MAD filter
      validatedRrIntervals = filterRRIntervalsMAD(this.rrIntervalHistory); 
      
      // Calculate stability score based on validated intervals
      if (validatedRrIntervals.length >= 5) {
          const { median: medianRR, mad: madRR } = calculateMAD(validatedRrIntervals);
          if (!isNaN(medianRR) && medianRR > 0) {
              const coeffVar = (madRR / medianRR); // Coefficient of variation based on MAD
              rrStabilityScore = Math.max(0, 1 - coeffVar * 3); // Scale and clamp (higher coeffVar = lower score)
          }
      }

      // --- Feedback & Notification --- 
      if (this.isMonitoring && !this.isInWarmup() && Date.now() - this.lastProcessedPeakTime > this.MIN_PEAK_TIME_MS) {
        // Detect arrhythmia using VALIDATED intervals
        let arrhythmiaResult: ArrhythmiaDetectionResult | null = null;
        let isPotentialArrhythmia = false;
        if (validatedRrIntervals.length >= 5) { // Use validated intervals
           // TODO: Refactor ArrhythmiaDetectionService to accept validated intervals and provide fallback
           arrhythmiaResult = ArrhythmiaDetectionService.detectArrhythmia(validatedRrIntervals); 
           isPotentialArrhythmia = arrhythmiaResult?.isArrhythmia || false;
        }
        const isCurrentPeakArrhythmic = arrhythmiaResult?.isArrhythmia || false;
        
        // Adjust confidence for feedback based on signal quality & RR stability
        const feedbackConfidence = peakConfidence * (this.currentSignalQuality / 100) * rrStabilityScore;
        this.triggerHeartbeatFeedback(isCurrentPeakArrhythmic, feedbackConfidence);
        
        this.notifyPeakListeners({
          timestamp: Date.now(), 
          value: normalizedValue, 
          isArrhythmia: isCurrentPeakArrhythmic, 
          isPotentialArrhythmia: isPotentialArrhythmia
        });
        this.lastProcessedPeakTime = Date.now(); 
      }
    } else {
         validatedRrIntervals = filterRRIntervalsMAD(this.rrIntervalHistory); // Still filter for consistent RRData output
    }
    
    // Calculate BPM using VALIDATED intervals
    const rawBPM = calculateCurrentBPM(validatedRrIntervals); // Use validated intervals
    this.smoothBPM = smoothBPM(rawBPM, this.smoothBPM, this.BPM_ALPHA);
    
    // Final Confidence Score Calculation
    const finalConfidence = Math.max(0, Math.min(1, 
        (peakConfidence * 0.4 + rrStabilityScore * 0.4 + (this.currentSignalQuality / 100) * 0.2) * // Weighted blend
        (this.isInWarmup() ? 0.3 : 1) *                
        (this.isWeakSignal(value) ? 0.1 : 1) // Use raw value check for weak signal penalty             
    ));

    const rrData: RRIntervalData = {
      intervals: [...validatedRrIntervals], // Return validated intervals
      lastPeakTime: this.lastPeakTime
    };
    
    return {
      bpm: Math.round(this.smoothBPM),
      confidence: finalConfidence, // Use the combined confidence
      isPeak: isConfirmedPeak && !this.isInWarmup(),
      filteredValue,
      rrIntervals: [...validatedRrIntervals], // Return validated intervals
      lastPeakTime: this.lastPeakTime,
      rrData
    };
  }
  
  /**
   * Verifica si la señal es débil
   */
  private isWeakSignal(value: number): boolean {
    const valueAbs = Math.abs(value);
    const isCurrentlyWeak = valueAbs < this.LOW_SIGNAL_THRESHOLD;
    
    if (isCurrentlyWeak) {
      this.lowSignalCount++;
    } else {
      this.lowSignalCount = Math.max(0, this.lowSignalCount - 1);
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
    
    // Reset peak detection state
    this.peakDetectionState = getInitialPeakDetectionState();
    this.peakConfirmationState = getInitialPeakConfirmationState();
    
    // Reset signal quality
    this.currentSignalQuality = 0;
    
    console.log("HeartRateService: Reset complete - including peak detection states");
  }
}

export default HeartRateService.getInstance();
