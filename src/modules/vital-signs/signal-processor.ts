
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
 * Basic implementation focused on stability
 */
export class SignalProcessor extends BaseProcessor {
  private filter: SignalFilter;
  private quality: SignalQuality;
  private heartRateDetector: HeartRateDetector;
  private signalValidator: SignalValidator;
  
  // Basic finger detection variables
  private fingerDetectionConfirmed: boolean = false;
  
  // Basic signal quality thresholds
  private readonly MIN_QUALITY_FOR_FINGER = 40;
  private readonly MIN_SIGNAL_AMPLITUDE = 0.2;
  
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.01, 10);
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
   * Basic finger detection
   */
  public isFingerDetected(): boolean {
    return this.fingerDetectionConfirmed || this.signalValidator.isFingerDetected();
  }
  
  /**
   * Apply simple filtering for real signal processing
   */
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean } {
    // Track the signal
    this.signalValidator.trackSignalForPatternDetection(value);
    
    // Basic filtering steps
    const medianFiltered = this.applyMedianFilter(value);
    const lowPassFiltered = this.applyEMAFilter(medianFiltered);
    const smaFiltered = this.applySMAFilter(lowPassFiltered);
    
    // Calculate noise level
    this.quality.updateNoiseLevel(value, smaFiltered);
    
    // Calculate signal quality (0-100)
    const qualityValue = this.quality.calculateSignalQuality(this.ppgValues);
    
    // Store the filtered value
    this.ppgValues.push(smaFiltered);
    if (this.ppgValues.length > 30) {
      this.ppgValues.shift();
    }
    
    // Basic finger detection check
    const fingerDetected = this.signalValidator.isFingerDetected() && 
                          (qualityValue >= this.MIN_QUALITY_FOR_FINGER);
    
    // Calculate amplitude
    let amplitude = 0;
    if (this.ppgValues.length > 10) {
      const recentValues = this.ppgValues.slice(-10);
      amplitude = Math.max(...recentValues) - Math.min(...recentValues);
    }
    
    // Basic amplitude check
    const hasValidAmplitude = amplitude >= this.MIN_SIGNAL_AMPLITUDE;
    
    // Update finger detection status
    if (fingerDetected && hasValidAmplitude) {
      this.fingerDetectionConfirmed = true;
    } else if (!fingerDetected || !hasValidAmplitude) {
      this.fingerDetectionConfirmed = false;
    }
    
    return { 
      filteredValue: smaFiltered,
      quality: qualityValue,
      fingerDetected: (fingerDetected && hasValidAmplitude) || this.fingerDetectionConfirmed
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
   */
  public reset(): void {
    super.reset();
    this.quality.reset();
    this.signalValidator.resetFingerDetection();
    this.fingerDetectionConfirmed = false;
  }
}
