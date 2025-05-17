
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalFilter } from './processors/signal-filter';
import { SignalQuality } from './processors/signal-quality';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { SignalValidator } from './validators/signal-validator';

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
  
  // Finger detection state
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  // Signal quality variables - Umbral reducido para mejor detección
  private readonly MIN_QUALITY_FOR_FINGER = 35; 
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 3000;
  private readonly MIN_SIGNAL_AMPLITUDE = 0.20; // Umbral reducido para mejor detección
  
  // Added properties for raw signal and DC baseline
  private rawSignalBuffer: number[] = [];
  private readonly RAW_BUFFER_SIZE = 50;
  private dcBaseline: number = 0;
  
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.02, 15);
    this.rawSignalBuffer = [];
    this.dcBaseline = 0;
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
    // Si ya se confirmó la detección, mantenerla
    if (this.fingerDetectionConfirmed) {
      return true;
    }
    
    // Usar la detección del validador basada en patrones
    const patternBasedDetection = this.signalValidator.isFingerDetected();
    
    // Log para depuración
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
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean, acSignalValue: number, dcBaseline: number } {
    // Track the raw value
    this.rawSignalBuffer.push(value);
    if (this.rawSignalBuffer.length > this.RAW_BUFFER_SIZE) {
      this.rawSignalBuffer.shift();
    }
    
    // Update DC baseline with a slow EMA
    if (this.dcBaseline === 0) {
      this.dcBaseline = value;
    } else {
      this.dcBaseline = 0.95 * this.dcBaseline + 0.05 * value;
    }
    
    // Calculate AC component
    const acSignalValue = value - this.dcBaseline;
    
    // Seguir la señal para detección de patrones
    this.signalValidator.trackSignalForPatternDetection(value);
    
    // Aplicar filtros en serie - optimizados para mejor señal
    const medianFiltered = this.applyMedianFilter(value);
    const lowPassFiltered = this.applyEMAFilter(medianFiltered, 0.18); // Optimizado - alpha más sensible
    const smaFiltered = this.applySMAFilter(lowPassFiltered);
    
    // Calcular nivel de ruido de la señal real
    this.quality.updateNoiseLevel(value, smaFiltered);
    
    // Calcular calidad de señal (0-100)
    const qualityValue = this.quality.calculateSignalQuality(this.ppgValues);
    
    // Almacenar el valor filtrado en el buffer
    this.ppgValues.push(smaFiltered);
    if (this.ppgValues.length > 30) {
      this.ppgValues.shift();
    }
    
    // Verificar detección de dedo usando detección de patrones
    const patternDetection = this.signalValidator.isFingerDetected();
    const qualityDetection = qualityValue >= this.MIN_QUALITY_FOR_FINGER;
    
    // Calcular amplitud de señal
    let amplitude = 0;
    if (this.ppgValues.length > 10) {
      const recentValues = this.ppgValues.slice(-10);
      amplitude = Math.max(...recentValues) - Math.min(...recentValues);
    }
    
    // Requerir amplitud mínima para detección
    const hasValidAmplitude = amplitude >= this.MIN_SIGNAL_AMPLITUDE;
    
    // Detección mejorada: cualquier método de detección es válido
    const fingerDetected = (patternDetection || qualityDetection) && hasValidAmplitude;
    
    // Si se detecta dedo y tiene amplitud válida, confirmarlo
    if (fingerDetected && hasValidAmplitude && !this.fingerDetectionConfirmed) {
      const now = Date.now();
      
      if (!this.fingerDetectionStartTime) {
        this.fingerDetectionStartTime = now;
        console.log("Signal processor: Potential finger detection started", {
          time: new Date(now).toISOString(),
          quality: qualityValue,
          amplitude,
          byPattern: patternDetection,
          byQuality: qualityDetection
        });
      }
      
      // Si la detección ha sido consistente durante el período requerido, confirmarla
      if (this.fingerDetectionStartTime && (now - this.fingerDetectionStartTime >= this.MIN_PATTERN_CONFIRMATION_TIME)) {
        this.fingerDetectionConfirmed = true;
        this.rhythmBasedFingerDetection = true;
        console.log("Signal processor: Finger detection CONFIRMED!", {
          time: new Date(now).toISOString(),
          detectionMethod: patternDetection ? "Pattern" : "Quality",
          detectionDuration: (now - this.fingerDetectionStartTime) / 1000,
          quality: qualityValue,
          amplitude
        });
      }
    } else if (!fingerDetected || !hasValidAmplitude) {
      // Reiniciar la detección de dedo si se pierde o la amplitud es demasiado baja
      if (this.fingerDetectionConfirmed) {
        console.log("Signal processor: Finger detection lost", {
          hasValidPattern: patternDetection,
          hasValidQuality: qualityDetection,
          hasValidAmplitude,
          amplitude,
          quality: qualityValue
        });
      }
      
      this.fingerDetectionConfirmed = false;
      this.fingerDetectionStartTime = null;
      this.rhythmBasedFingerDetection = false;
    }
    
    // Log de detección de dedo
    if ((fingerDetected && hasValidAmplitude) || this.fingerDetectionConfirmed) {
      console.log("DETECCIÓN DE DEDO ACTIVA", {
        timestamp: new Date().toISOString(),
        porPatrones: patternDetection,
        porCalidad: qualityDetection,
        porAmplitud: hasValidAmplitude,
        confirmado: this.fingerDetectionConfirmed
      });
    }
    
    return { 
      filteredValue: smaFiltered,
      quality: qualityValue,
      fingerDetected: (fingerDetected && hasValidAmplitude) || this.fingerDetectionConfirmed,
      acSignalValue: acSignalValue,
      dcBaseline: this.dcBaseline
    };
  }
  
  /**
   * Calculate heart rate from real PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    return this.heartRateDetector.calculateHeartRate(this.ppgValues, sampleRate);
  }
  
  /**
   * Get RR intervals data
   */
  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    return this.heartRateDetector.getRRIntervals();
  }
  
  /**
   * Get raw signal buffer
   */
  public getRawSignalBuffer(): number[] {
    return [...this.rawSignalBuffer];
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
    this.rawSignalBuffer = [];
    this.dcBaseline = 0;
  }
}
