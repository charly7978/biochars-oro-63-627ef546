
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalFilter } from './processors/signal-filter';
import { SignalQuality } from './processors/signal-quality';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { SignalValidator } from './validators/signal-validator';
import { antiRedundancyGuard } from '../../core/validation/CrossValidationSystem';

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
  
  // Finger detection state - more sensitive thresholds
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  // Signal quality variables - adjusted thresholds for better detection
  private readonly MIN_QUALITY_FOR_FINGER = 25; // Decreased for higher sensitivity
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 2500; // Decreased for faster detection
  private readonly MIN_SIGNAL_AMPLITUDE = 0.15; // Decreased from previous value
  
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.005, 8); // More sensitive thresholds
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
    // If already confirmed through consistent patterns, maintain detection
    if (this.fingerDetectionConfirmed) {
      return true;
    }
    
    // Otherwise, use the validator's pattern detection
    return this.signalValidator.isFingerDetected();
  }
  
  /**
   * Apply combined filtering for real signal processing
   * No simulation is used
   * Incorporates rhythmic pattern-based finger detection
   */
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean } {
    // Early signal validation - log raw values for debugging
    console.log("SignalProcessor raw value:", value);
    
    // Track the signal for pattern detection - critical for finger detection
    this.signalValidator.trackSignalForPatternDetection(value);

    // Apply filters
    const medianFiltered = this.applyMedianFilter(value);
    const lowPassFiltered = this.applyEMAFilter(medianFiltered);
    const smaFiltered = this.applySMAFilter(lowPassFiltered);
    
    // Calculate signal quality
    this.quality.updateNoiseLevel(value, smaFiltered);
    const qualityValue = this.quality.calculateSignalQuality(this.ppgValues);
    
    // Update signal buffer
    this.ppgValues.push(smaFiltered);
    if (this.ppgValues.length > 30) {
      this.ppgValues.shift();
    }
    
    // Enhanced finger detection with amplitude checks - more forgiving
    let amplitude = 0;
    if (this.ppgValues.length > 5) {
      const recentValues = this.ppgValues.slice(-5);
      amplitude = Math.max(...recentValues) - Math.min(...recentValues);
    }
    
    // Check for valid finger detection conditions - more lenient conditions
    const validatorDetection = this.signalValidator.isFingerDetected();
    const qualityCheck = qualityValue >= this.MIN_QUALITY_FOR_FINGER || this.fingerDetectionConfirmed;
    const amplitudeCheck = amplitude >= this.MIN_SIGNAL_AMPLITUDE;
    
    // Log detection metrics for debugging
    console.log("Finger detection metrics:", {
      validatorDetection,
      qualityValue,
      qualityCheck,
      amplitude,
      amplitudeCheck
    });
    
    const fingerDetected = validatorDetection && qualityCheck && amplitudeCheck;

    // Update finger detection state with more progressive detection
    if (fingerDetected && !this.fingerDetectionConfirmed) {
      const now = Date.now();
      
      if (!this.fingerDetectionStartTime) {
        this.fingerDetectionStartTime = now;
        console.log("Signal processor: Potential finger detection started", {
          time: new Date(now).toISOString(),
          quality: qualityValue,
          amplitude
        });
      }
      
      if (this.fingerDetectionStartTime && 
          (now - this.fingerDetectionStartTime >= this.MIN_PATTERN_CONFIRMATION_TIME)) {
        this.fingerDetectionConfirmed = true;
        this.rhythmBasedFingerDetection = true;
        console.log("Signal processor: Finger detection CONFIRMED!", {
          time: new Date(now).toISOString(),
          quality: qualityValue,
          amplitude
        });
      }
    } else if (!fingerDetected) {
      // Be more conservative about losing finger detection - add hysteresis
      if (this.fingerDetectionConfirmed) {
        // Only lose detection if conditions are really bad
        if (amplitude < this.MIN_SIGNAL_AMPLITUDE * 0.5 || qualityValue < this.MIN_QUALITY_FOR_FINGER * 0.5) {
          console.log("Signal processor: Finger detection lost", {
            quality: qualityValue,
            amplitude
          });
          this.fingerDetectionConfirmed = false;
          this.fingerDetectionStartTime = null;
          this.rhythmBasedFingerDetection = false;
        }
      } else {
        this.fingerDetectionStartTime = null;
        this.rhythmBasedFingerDetection = false;
      }
    }

    return {
      filteredValue: smaFiltered,
      quality: qualityValue,
      fingerDetected: fingerDetected || this.fingerDetectionConfirmed
    };
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
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
  }
}

// Registrar el archivo y la tarea única globalmente (fuera de la clase)
antiRedundancyGuard.registerFile('src/modules/vital-signs/signal-processor.ts');
antiRedundancyGuard.registerTask('SignalProcessorSingleton');
