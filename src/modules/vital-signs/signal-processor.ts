/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalFilter } from './processors/signal-filter';
import { SignalQuality } from './processors/signal-quality';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { SignalValidator } from './validators/signal-validator';
import { KalmanFilter } from '@/core/signal/filters/KalmanFilter';
import { BandpassFilter } from '@/core/signal/filters/BandpassFilter';

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
  private kalmanFilter: KalmanFilter;
  private bandpassFilter: BandpassFilter;
  
  // Finger detection state
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  // Signal quality variables - more strict thresholds
  private readonly MIN_QUALITY_FOR_FINGER = 45; // Increased from default
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 3500; // Increased from 3000
  private readonly MIN_SIGNAL_AMPLITUDE = 0.01; // Ajustado para ser más sensible después del pasa-banda
  
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(this.MIN_SIGNAL_AMPLITUDE);
    this.kalmanFilter = new KalmanFilter();
    this.bandpassFilter = new BandpassFilter(0.5, 4, 30);
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
    
    const currentQuality = this.quality.calculateSignalQuality(this.ppgValues);
    const patternDetected = this.signalValidator.isFingerDetected();

    if (patternDetected && currentQuality > this.MIN_QUALITY_FOR_FINGER) {
      if (!this.fingerDetectionStartTime) {
        this.fingerDetectionStartTime = Date.now();
      } else if (Date.now() - this.fingerDetectionStartTime > this.MIN_PATTERN_CONFIRMATION_TIME) {
        this.fingerDetectionConfirmed = true;
        return true;
      }
    } else {
      this.fingerDetectionStartTime = null;
    }
    return false;
  }
  
  /**
   * Apply combined filtering for real signal processing
   * No simulation is used
   * Incorporates rhythmic pattern-based finger detection
   */
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean } {
    this.ppgValues.push(value);
    if (this.ppgValues.length > 100) {
      this.ppgValues.shift();
    }
    this.signalValidator.trackSignalForPatternDetection(value);

    const kalmanFiltered = this.kalmanFilter.filter(value);
    const bandpassFiltered = this.bandpassFilter.filter(kalmanFiltered);

    const finalFiltered = bandpassFiltered;

    this.quality.updateNoiseLevel(value, finalFiltered);
    const currentQuality = this.quality.calculateSignalQuality(this.ppgValues.map(v => this.bandpassFilter.filter(this.kalmanFilter.filter(v))));

    const fingerDetected = this.isFingerDetected();

    return {
      filteredValue: finalFiltered,
      quality: currentQuality,
      fingerDetected: fingerDetected
    };
  }
  
  /**
   * Calculate heart rate from real PPG values
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    const filteredBuffer = this.ppgValues.map(v => this.bandpassFilter.filter(this.kalmanFilter.filter(v)));
    return this.heartRateDetector.calculateHeartRate(filteredBuffer, sampleRate);
  }
  
  /**
   * Reset the signal processor
   * Ensures all measurements start from zero
   */
  public reset(): void {
    super.reset();
    this.filter = new SignalFilter();
    this.quality.reset();
    this.heartRateDetector.reset();
    this.signalValidator.resetFingerDetection();
    this.kalmanFilter.reset();
    this.bandpassFilter.reset();
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
  }
}
