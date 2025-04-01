/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalFilter } from './processors/signal-filter';
import { SignalQuality } from './processors/signal-quality';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { SignalValidator } from './validators/signal-validator';
import { MotionArtifactManager } from './processors/motion-artifact-manager';
import { evaluateSignalConsistency, detectMotionInSignal } from '../../hooks/heart-beat/signal-quality';

/**
 * Signal processor for real PPG signals
 * Implements filtering and analysis techniques on real data only
 * Enhanced with rhythmic pattern detection for finger presence
 * Improved with motion artifact detection and compensation
 */
export class SignalProcessor extends BaseProcessor {
  private filter: SignalFilter;
  private quality: SignalQuality;
  private heartRateDetector: HeartRateDetector;
  private signalValidator: SignalValidator;
  private motionArtifactManager: MotionArtifactManager;
  
  // Finger detection state
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  // Signal quality variables - more strict thresholds
  private readonly MIN_QUALITY_FOR_FINGER = 45; // Increased from default
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 3500; // Increased from 3000
  private readonly MIN_SIGNAL_AMPLITUDE = 0.25; // Increased from previous value
  
  // Nuevo: Variables para monitoreo de artefactos de movimiento
  private motionDetected: boolean = false;
  private motionCompensationActive: boolean = false;
  private motionArtifactHistory: boolean[] = [];
  private readonly MOTION_HISTORY_SIZE = 10;
  private lastMotionDetectedTime: number = 0;
  private readonly MOTION_RECOVERY_TIME = 1500; // ms
  
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.02, 15); // Increased thresholds
    
    // Fix: Pass proper configuration object instead of just sensitivity value
    this.motionArtifactManager = new MotionArtifactManager({
      threshold: 3.5,
      windowSize: 10,
      recoveryTime: 1500,
      adaptiveThreshold: true
    });
    
    // Set sensitivity after initialization
    this.motionArtifactManager.setSensitivity(0.75);
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
   */
  public isFingerDetected(): boolean {
    // If already confirmed through consistent patterns, maintain detection
    if (this.fingerDetectionConfirmed) {
      return true;
    }
    
    // Otherwise, use the validator's pattern detection
    return this.signalValidator.isFingerDetected();
  }

  /**
   * Nuevo: Detectar artefactos de movimiento en la señal
   */
  public detectMotionArtifacts(value: number, accelerometerData?: {x: number, y: number, z: number}): boolean {
    // Usar el administrador especializado para detección
    const timestamp = Date.now();
    const result = this.motionArtifactManager.processValue(value, timestamp, accelerometerData);
    
    // Actualizar historial
    this.motionArtifactHistory.push(result.isArtifact);
    if (this.motionArtifactHistory.length > this.MOTION_HISTORY_SIZE) {
      this.motionArtifactHistory.shift();
    }
    
    // Actualizar estado
    if (result.isArtifact) {
      this.lastMotionDetectedTime = Date.now();
      this.motionDetected = true;
    } else if (Date.now() - this.lastMotionDetectedTime > this.MOTION_RECOVERY_TIME) {
      this.motionDetected = false;
    }
    
    this.motionCompensationActive = result.isArtifact && result.correctedValue !== undefined;
    
    return this.motionDetected;
  }
  
  /**
   * Nuevo: Obtener métricas sobre la calidad de señal y artefactos
   */
  public getSignalMetrics(windowSize: number = 15): {
    quality: number;
    hasMotion: boolean;
    motionCompensationActive: boolean;
    consistency: number;
    fingerDetected: boolean;
  } {
    // Evaluando la consistencia de la señal
    const consistencyResult = evaluateSignalConsistency(this.ppgValues, windowSize);
    
    // Calcular porcentaje de detecciones de movimiento recientes
    const motionPercentage = this.motionArtifactHistory.filter(Boolean).length / 
                            Math.max(1, this.motionArtifactHistory.length);
    
    // Devolver métricas consolidadas
    return {
      quality: this.quality.calculateSignalQuality(this.ppgValues),
      hasMotion: this.motionDetected || motionPercentage > 0.3 || consistencyResult.hasMotion,
      motionCompensationActive: this.motionCompensationActive,
      consistency: consistencyResult.consistency,
      fingerDetected: this.isFingerDetected()
    };
  }
  
  /**
   * Apply combined filtering for real signal processing with motion compensation
   */
  public applyFilters(
    value: number, 
    accelerometerData?: {x: number, y: number, z: number},
    irValue?: number
  ): { 
    filteredValue: number, 
    quality: number, 
    fingerDetected: boolean,
    motionDetected: boolean,
    motionCompensated: boolean
  } {
    // Track the signal for pattern detection
    this.signalValidator.trackSignalForPatternDetection(value);
    
    // Detect motion artifacts and apply compensation
    const hasMotionArtifact = this.detectMotionArtifacts(value, accelerometerData);
    
    // Apply complete filter pipeline with motion compensation
    const filterResult = this.filter.applyCompleteFilterWithMotionCompensation(
      value, 
      this.ppgValues,
      accelerometerData,
      irValue
    );
    
    // Store the filtered value in the buffer
    this.ppgValues.push(filterResult.filteredValue);
    if (this.ppgValues.length > 30) {
      this.ppgValues.shift();
    }
    
    // Calculate signal quality
    const qualityValue = this.quality.calculateSignalQuality(this.ppgValues);
    
    // Calculate signal amplitude
    let amplitude = 0;
    if (this.ppgValues.length > 10) {
      const recentValues = this.ppgValues.slice(-10);
      amplitude = Math.max(...recentValues) - Math.min(...recentValues);
    }
    
    // Check finger detection using pattern recognition with a higher quality threshold
    const fingerDetected = this.signalValidator.isFingerDetected() && 
                          (qualityValue >= this.MIN_QUALITY_FOR_FINGER || this.fingerDetectionConfirmed);
    
    // Require minimum amplitude for detection (physiological requirement)
    const hasValidAmplitude = amplitude >= this.MIN_SIGNAL_AMPLITUDE;
    
    // Update finger detection state
    this.updateFingerDetectionState(fingerDetected, hasValidAmplitude, qualityValue, amplitude);
    
    return { 
      filteredValue: filterResult.filteredValue,
      quality: qualityValue,
      fingerDetected: (fingerDetected && hasValidAmplitude) || this.fingerDetectionConfirmed,
      motionDetected: hasMotionArtifact,
      motionCompensated: filterResult.appliedCompensation
    };
  }
  
  /**
   * Actualizar estado de detección de dedo
   */
  private updateFingerDetectionState(
    fingerDetected: boolean, 
    hasValidAmplitude: boolean,
    qualityValue: number,
    amplitude: number
  ): void {
    // If finger is detected by pattern and has valid amplitude, confirm it
    if (fingerDetected && hasValidAmplitude && !this.fingerDetectionConfirmed) {
      const now = Date.now();
      
      if (!this.fingerDetectionStartTime) {
        this.fingerDetectionStartTime = now;
        console.log("Signal processor: Potential finger detection started", {
          time: new Date(now).toISOString(),
          quality: qualityValue,
          amplitude
        });
      }
      
      // If finger detection has been consistent for required time period, confirm it
      if (this.fingerDetectionStartTime && (now - this.fingerDetectionStartTime >= this.MIN_PATTERN_CONFIRMATION_TIME)) {
        this.fingerDetectionConfirmed = true;
        this.rhythmBasedFingerDetection = true;
        console.log("Signal processor: Finger detection CONFIRMED by rhythm pattern!", {
          time: new Date(now).toISOString(),
          detectionMethod: "Rhythmic pattern detection",
          detectionDuration: (now - this.fingerDetectionStartTime) / 1000,
          quality: qualityValue,
          amplitude
        });
      }
    } else if (!fingerDetected || !hasValidAmplitude) {
      // Reset finger detection if lost or amplitude too low
      if (this.fingerDetectionConfirmed) {
        console.log("Signal processor: Finger detection lost", {
          hasValidPattern: fingerDetected,
          hasValidAmplitude,
          amplitude,
          quality: qualityValue
        });
      }
      
      this.fingerDetectionConfirmed = false;
      this.fingerDetectionStartTime = null;
      this.rhythmBasedFingerDetection = false;
    }
  }
  
  /**
   * Calculate heart rate from real PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    return this.heartRateDetector.calculateHeartRate(this.ppgValues, sampleRate);
  }
  
  /**
   * Reset the signal processor
   * Ensures all measurements start from zero
   */
  public reset(): void {
    super.reset();
    this.quality.reset();
    this.signalValidator.resetFingerDetection();
    this.filter.reset();
    this.motionArtifactManager.reset();
    
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
    
    this.motionDetected = false;
    this.motionCompensationActive = false;
    this.motionArtifactHistory = [];
    this.lastMotionDetectedTime = 0;
  }
}
