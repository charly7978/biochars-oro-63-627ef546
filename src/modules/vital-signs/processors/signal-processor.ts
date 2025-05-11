/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './base-processor';
import { SignalFilter } from './signal-filter';
import { SignalQuality } from './signal-quality';
import { HeartRateDetector } from './heart-rate-detector';
import { SignalValidator } from '../validators/signal-validator'; // Ajustar ruta si es necesario

/**
 * Signal processor for real PPG signals
 * Implements filtering and analysis techniques on real data only
 * Enhanced with rhythmic pattern detection for finger presence
 * No simulation or reference values are used
 */
export class SignalProcessor extends BaseProcessor {
  private filter: SignalFilter;
  private quality: SignalQuality;
  private heartRateDetector: HeartRateDetector;
  private signalValidator: SignalValidator;
  
  // Finger detection state (asegurar que estas propiedades existan)
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  // Signal quality variables (asegurar que estas propiedades existan)
  private readonly MIN_QUALITY_FOR_FINGER = 45; 
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 3500;
  private readonly MIN_SIGNAL_AMPLITUDE = 0.05; // Umbral para la amplitud de la señal AC
  
  private dcBaseline: number = 0;
  private readonly DC_BASELINE_ALPHA = 0.01; // Adaptación lenta para la línea base DC
  private rawSignalBuffer: number[] = []; // Para calcular la línea base DC de forma más robusta
  private readonly RAW_BUFFER_SIZE = 50; // Usar 50 muestras para la línea base DC
  
  // Buffers para las etapas de filtrado de la señal AC
  private acSignalRawBuffer: number[] = [];
  private medianFilteredAcSignalBuffer: number[] = [];
  private emaFilteredAcSignalBuffer: number[] = []; // EMA en SignalFilter usa el último valor del buffer pasado como EMA previo

  private readonly FILTER_BUFFER_SIZE = 15; // Tamaño común para buffers de filtrado intermedio
  
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.02, 15); // Valores por defecto, ajustar si es necesario
    this.dcBaseline = 0; // Inicializar dcBaseline
  }
  
  private updateDcBaseline(rawValue: number): void {
    this.rawSignalBuffer.push(rawValue);
    if (this.rawSignalBuffer.length > this.RAW_BUFFER_SIZE) {
      this.rawSignalBuffer.shift();
    }
    if (this.rawSignalBuffer.length < this.RAW_BUFFER_SIZE / 2) { // Esperar a tener suficientes muestras
        if (this.dcBaseline === 0) this.dcBaseline = rawValue; // Primera estimación
        else this.dcBaseline = this.dcBaseline * (1 - 0.1) + rawValue * 0.1; // Adaptación más rápida al inicio
        return;
    }
    // Usar promedio móvil para la línea base una vez que el buffer está lleno
    this.dcBaseline = this.rawSignalBuffer.reduce((sum, val) => sum + val, 0) / this.rawSignalBuffer.length;
    // O una EMA más lenta:
    // if (this.dcBaseline === 0) this.dcBaseline = rawValue;
    // else this.dcBaseline = this.dcBaseline * (1 - this.DC_BASELINE_ALPHA) + rawValue * this.DC_BASELINE_ALPHA;
  }

  private addToBuffer(buffer: number[], value: number, maxSize: number): void {
    buffer.push(value);
    if (buffer.length > maxSize) {
      buffer.shift();
    }
  }

  /**
   * Apply Moving Average filter to real values
   */
  public applySMAFilter(value: number): number {
    return this.filter.applySMAFilter(value, this.ppgValues);
  }
  
  /**
   * Apply Exponential Moving Average filter to real data
   */
  public applyEMAFilter(value: number, alpha?: number): number {
    return this.filter.applyEMAFilter(value, this.ppgValues, alpha);
  }
  
  /**
   * Apply median filter to real data
   */
  public applyMedianFilter(value: number): number {
    return this.filter.applyMedianFilter(value, this.ppgValues);
  }
  
  /**
   * Check if finger is detected based on rhythmic patterns
   * Uses physiological characteristics (heartbeat rhythm)
   */
  public isFingerDetected(): boolean {
    if (this.fingerDetectionConfirmed) {
      return true;
    }
    const patternBasedDetection = this.signalValidator.isFingerDetected();
    if (patternBasedDetection) {
      console.log("SignalProcessor: Pattern-based finger detection is ACTIVE", {
        time: new Date().toISOString(),
        confirmed: this.fingerDetectionConfirmed
      });
    }
    return patternBasedDetection;
  }

  /**
   * Apply combined filtering for real signal processing
   * No simulation is used
   * Incorporates rhythmic pattern-based finger detection
   */
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean, acSignalValue: number } {
    this.signalValidator.trackSignalForPatternDetection(value);
    
    this.updateDcBaseline(value);    
    const acSignal = value - this.dcBaseline;
    this.addToBuffer(this.acSignalRawBuffer, acSignal, this.FILTER_BUFFER_SIZE);

    const medianFiltered = this.filter.applyMedianFilter(acSignal, this.acSignalRawBuffer);
    this.addToBuffer(this.medianFilteredAcSignalBuffer, medianFiltered, this.FILTER_BUFFER_SIZE);
    
    // EMAFilter usa el último valor del buffer que se le pasa como el EMA anterior.
    // Así que pasamos medianFilteredAcSignalBuffer, que contendrá los EMA previos en futuras llamadas.
    const emaFiltered = this.filter.applyEMAFilter(medianFiltered, this.medianFilteredAcSignalBuffer); 
    this.addToBuffer(this.emaFilteredAcSignalBuffer, emaFiltered, this.FILTER_BUFFER_SIZE);
        
    const smaFiltered = this.filter.applySMAFilter(emaFiltered, this.emaFilteredAcSignalBuffer);
    
    this.ppgValues.push(smaFiltered); 
    if (this.ppgValues.length > 100) { // Buffer principal para calidad y HR
      this.ppgValues.shift();
    }

    this.quality.updateNoiseLevel(acSignal, smaFiltered);
    const qualityValue = this.quality.calculateSignalQuality(this.ppgValues);
        
    const patternFingerDetected = this.signalValidator.isFingerDetected(); 
    const fingerDetectedByQuality = qualityValue >= this.MIN_QUALITY_FOR_FINGER;

    let amplitudeAC = 0;
    if (this.ppgValues.length > 10) { 
      const recentAcValues = this.ppgValues.slice(-10);
      amplitudeAC = Math.max(...recentAcValues) - Math.min(...recentAcValues);
    }
    const hasValidAmplitude = amplitudeAC >= this.MIN_SIGNAL_AMPLITUDE;

    const finalFingerDetected = (patternFingerDetected && hasValidAmplitude && fingerDetectedByQuality) || this.fingerDetectionConfirmed;

    if (finalFingerDetected && !this.fingerDetectionConfirmed) {
      const now = Date.now();
      if (!this.fingerDetectionStartTime) {
        this.fingerDetectionStartTime = now;
        console.log("Signal processor: Potential finger detection started", {
          time: new Date(now).toISOString(), quality: qualityValue, amplitude: amplitudeAC
        });
      }
      if (this.fingerDetectionStartTime && (now - this.fingerDetectionStartTime >= this.MIN_PATTERN_CONFIRMATION_TIME)) {
        this.fingerDetectionConfirmed = true;
        this.rhythmBasedFingerDetection = true; 
        console.log("Signal processor: Finger detection CONFIRMED!", {
          time: new Date(now).toISOString(), detectionDuration: (now - this.fingerDetectionStartTime) / 1000, quality: qualityValue, amplitude: amplitudeAC
        });
      }
    } else if (!finalFingerDetected && this.fingerDetectionConfirmed) {
      console.log("Signal processor: Finger detection lost", { patternFingerDetected, hasValidAmplitude, quality: qualityValue, amplitude: amplitudeAC });
      this.fingerDetectionConfirmed = false;
      this.fingerDetectionStartTime = null;
      this.rhythmBasedFingerDetection = false;
    }

    if (finalFingerDetected) {
      console.log("DETECCIÓN DE DEDO ACTIVA (SignalProcessor.applyFilters)", {
        timestamp: new Date().toISOString(), patternFingerDetected, fingerDetectedByQuality, hasValidAmplitude, amplitudeAC, confirmed: this.fingerDetectionConfirmed
      });
    }

    return { 
      filteredValue: smaFiltered, 
      quality: qualityValue,
      fingerDetected: finalFingerDetected,
      acSignalValue: acSignal 
    };
  }
  
  /**
   * Calculate heart rate from real PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    // Ensure ppgValues is passed correctly, as it's a property of this class
    return this.heartRateDetector.calculateHeartRate(this.ppgValues, sampleRate);
  }
  
  /**
   * Get RR intervals from the heart rate detector
   */
  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    const peakTimes = this.heartRateDetector.getPeakTimes();
    if (peakTimes.length < 2) {
      return { intervals: [], lastPeakTime: peakTimes.length > 0 ? peakTimes[peakTimes.length - 1] : null };
    }

    const intervals: number[] = [];
    for (let i = 1; i < peakTimes.length; i++) {
      const interval = peakTimes[i] - peakTimes[i-1];
      if (interval >= 250 && interval <= 2000) { 
        intervals.push(interval);
      }
    }
    return {
      intervals,
      lastPeakTime: peakTimes.length > 0 ? peakTimes[peakTimes.length - 1] : null
    };
  }

  /**
   * Placeholder for a method that might be expected by VitalSignsProcessor.
   * Real amplitude validation is done within applyFilters for fingerDetected state.
   */
  public hasValidAmplitude(values: number[]): boolean {
    if (values.length < 10) return false;
    const amplitude = Math.max(...values) - Math.min(...values);
    return amplitude >= this.MIN_SIGNAL_AMPLITUDE; 
  }

  /**
   * Placeholder for a method that might be expected by VitalSignsProcessor for logging.
   */
  public logValidationResults(isValid: boolean, amplitude: number, values: number[]): void {
    // This method might be called by VitalSignsProcessor if it still expects it.
    // For now, primary logging is within applyFilters.
    console.log("SignalProcessor logValidationResults (called externally):", { isValid, amplitude, valueCount: values.length });
  }

  /**
   * Reset the signal processor
   * Ensures all measurements start from zero
   */
  public reset(): void {
    super.reset(); 
    this.quality.reset();
    this.heartRateDetector.reset(); 
    this.signalValidator.resetFingerDetection(); 
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
    this.dcBaseline = 0; // Resetear DC baseline
    this.rawSignalBuffer = []; // Resetear buffer de señal raw
    this.acSignalRawBuffer = [];
    this.medianFilteredAcSignalBuffer = [];
    this.emaFilteredAcSignalBuffer = [];
    console.log("SignalProcessor: Reset complete");
  }
} 