/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalFilter } from './processors/signal-filter';
import { SignalQuality } from './processors/signal-quality';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { SignalValidator } from './validators/signal-validator';
import { SignalQualityDetector } from './quality/SignalQualityDetector';

/**
 * Signal processor for real PPG signals
 * Implements filtering and analysis techniques on real data only
 * Enhanced with rhythmic pattern detection for finger presence
 * No simulation or reference values are used
 * Ahora utiliza la implementación central de detección de dedos
 */
export class SignalProcessor extends BaseProcessor {
  private filter: SignalFilter;
  private quality: SignalQuality;
  private heartRateDetector: HeartRateDetector;
  private signalValidator: SignalValidator;
  
  // Detector centralizado
  private fingerDetector: SignalQualityDetector;
  
  // Signal quality variables
  private readonly MIN_QUALITY_FOR_FINGER = 55;
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 3500;
  private readonly MIN_SIGNAL_AMPLITUDE = 0.30;
  private consecutiveConfirmationFrames: number = 0;
  private readonly REQUIRED_CONSECUTIVE_CONFIRMATION_FRAMES: number = 20;
  
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.02, 15);
    
    // Inicializar detector centralizado de dedos como clase
    this.fingerDetector = new SignalQualityDetector({
      weakSignalThreshold: 0.15,
      minSignalVariance: 0.02,
      requiredConsistentPatterns: 2
    });
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
   * Ahora utiliza el detector centralizado
   */
  public isFingerDetected(): boolean {
    return this.fingerDetector.isFingerDetected();
  }
  
  /**
   * Apply combined filtering for real signal processing
   * No simulation is used
   * Incorporates rhythmic pattern-based finger detection from detector central
   */
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean } {
    // Track the signal for pattern detection
    const isWeak = this.fingerDetector.detectWeakSignal(value);
    
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
    
    // Usar el detector centralizado
    const fingerDetected = this.fingerDetector.isFingerDetected();
    
    return { 
      filteredValue: smaFiltered,
      quality: qualityValue,
      fingerDetected: fingerDetected
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
    this.consecutiveConfirmationFrames = 0;
    
    // Restablecer detector centralizado
    this.fingerDetector.reset();
  }
}
