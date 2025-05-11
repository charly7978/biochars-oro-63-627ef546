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
  
  // Signal quality variables - more strict thresholds
  private readonly MIN_QUALITY_FOR_FINGER = 45; // Increased from default
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 3500; // Increased from 3000
  private readonly MIN_SIGNAL_AMPLITUDE = 0.25; // Increased from previous value
  private consecutiveConfirmationFrames: number = 0; // Nuevo: contador de frames de confirmación
  private readonly REQUIRED_CONSECUTIVE_CONFIRMATION_FRAMES: number = 15; // Nuevo: umbral de frames consecutivos
  
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.02, 15); // Increased thresholds
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
    // Track the signal for pattern detection
    this.signalValidator.trackSignalForPatternDetection(value);
    
    // Step 1: Median filter to remove outliers
    const medianFiltered = this.applyMedianFilter(value);
    
    // Step 2: Low pass filter to smooth the signal
    const lowPassFiltered = this.applyEMAFilter(medianFiltered);
    
    // Step 3: Moving average for final smoothing
    const smaFiltered = this.applySMAFilter(lowPassFiltered);
    
    // Calculate noise level of real signal
    this.quality.updateNoiseLevel(value, smaFiltered);
    
    // Calculate signal quality (0-100)
    const qualityValue = this.quality.calculateSignalQuality(this.ppgValues);
    
    // Store the filtered value in the buffer
    this.ppgValues.push(smaFiltered);
    if (this.ppgValues.length > 30) {
      this.ppgValues.shift();
    }
    
    // Check finger detection using pattern recognition from SignalValidator
    const patternBasedFingerDetected = this.signalValidator.isFingerDetected();
    
    // Calculate signal amplitude from recent PPG values
    let amplitude = 0;
    if (this.ppgValues.length > 10) {
      const recentValues = this.ppgValues.slice(-10);
      amplitude = Math.max(...recentValues) - Math.min(...recentValues);
    }

    // Physiological and quality requirements for the signal
    const hasValidAmplitude = amplitude >= this.MIN_SIGNAL_AMPLITUDE;
    const hasValidQuality = qualityValue >= this.MIN_QUALITY_FOR_FINGER;

    // Logic for confirming finger detection
    if (patternBasedFingerDetected && hasValidAmplitude && hasValidQuality) {
      const now = Date.now();

      if (!this.fingerDetectionStartTime) {
        this.fingerDetectionStartTime = now;
        this.consecutiveConfirmationFrames = 0; // Reset frames when a new potential sequence starts
        console.log("Signal processor: Potential finger detection sequence INITIALIZED", {
          time: new Date(now).toISOString(),
          quality: qualityValue,
          amplitude
        });
      }

      this.consecutiveConfirmationFrames++; // Increment for each valid frame in the sequence

      // Confirm detection if time and consecutive frames thresholds are met, and not already confirmed
      if (this.fingerDetectionStartTime &&
          (now - this.fingerDetectionStartTime >= this.MIN_PATTERN_CONFIRMATION_TIME) &&
          this.consecutiveConfirmationFrames >= this.REQUIRED_CONSECUTIVE_CONFIRMATION_FRAMES &&
          !this.fingerDetectionConfirmed // Confirm only once per valid sequence
      ) {
        this.fingerDetectionConfirmed = true;
        this.rhythmBasedFingerDetection = true; // Retain if used elsewhere
        console.log("Signal processor: Finger detection CONFIRMED (Pattern, Amplitude, Quality, Stability Met)", {
          time: new Date(now).toISOString(),
          detectionDurationMs: now - this.fingerDetectionStartTime,
          confirmedFrames: this.consecutiveConfirmationFrames,
          quality: qualityValue,
          amplitude
        });
      }
    } else {
      // If conditions are not met, reset confirmation state
      if (this.fingerDetectionConfirmed) { // Log only if it was previously confirmed
        console.log("Signal processor: Finger detection LOST (Pattern, Amplitude, or Quality not met)", {
          patternDetected: patternBasedFingerDetected,
          currentAmplitude: amplitude,
          currentQuality: qualityValue,
          consecutiveFramesAchieved: this.consecutiveConfirmationFrames,
          wasConfirmed: this.fingerDetectionConfirmed
        });
      }
      this.fingerDetectionConfirmed = false;
      this.fingerDetectionStartTime = null;
      this.rhythmBasedFingerDetection = false;
      this.consecutiveConfirmationFrames = 0; // Reset frame counter
    }
    
    return { 
      filteredValue: smaFiltered,
      quality: qualityValue,
      fingerDetected: this.fingerDetectionConfirmed // Return the confirmed state
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
    this.consecutiveConfirmationFrames = 0; // Ensure reset of the new counter
  }
}
