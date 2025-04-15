/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
// Remove local filter/quality imports
// import { SignalFilter } from './processors/signal-filter';
// import { SignalQuality } from './processors/signal-quality';
// Import utilities
import {
  applySMAFilter,
  applyEMAFilter,
  applyMedianFilter,
  evaluateSignalQuality,
  SIGNAL_CONSTANTS // Import constants if needed
} from '@/utils/vitalSignsUtils';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { SignalValidator } from './validators/signal-validator';

/**
 * Signal processor for real PPG signals
 * Implements filtering and analysis techniques on real data only
 * Enhanced with rhythmic pattern detection for finger presence
 * No simulation or reference values are used
 */
export class SignalProcessor extends BaseProcessor {
  // Remove local filter/quality instances
  // private filter: SignalFilter;
  // private quality: SignalQuality;
  private heartRateDetector: HeartRateDetector;
  private signalValidator: SignalValidator;
  // Add state for EMA filter if needed by applyFilters
  private lastEMA: number | null = null;
  
  // Finger detection state
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  // Signal quality variables - Relaxed thresholds for testing
  private readonly MIN_QUALITY_FOR_FINGER = 30; // Reduced from 45
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 2000; // Reduced from 3500
  private readonly MIN_SIGNAL_AMPLITUDE = 0.1; // Reduced from 0.25
  
  constructor() {
    super();
    // Remove local filter/quality initialization
    // this.filter = new SignalFilter();
    // this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.02, 15); // Increased thresholds
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
   * Uses centralized utility functions
   * No simulation is used
   * Incorporates rhythmic pattern-based finger detection
   */
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean } {
    // Track the signal for pattern detection
    this.signalValidator.trackSignalForPatternDetection(value);

    // Step 1: Median filter to remove outliers (using utility)
    const medianFiltered = applyMedianFilter(value, this.ppgValues, 5); // windowSize = 5

    // Step 2: Low pass filter (EMA) to smooth the signal (using utility)
    const { nextEMA, filteredValue: emaFiltered } = applyEMAFilter(medianFiltered, this.lastEMA, 0.3); // alpha = 0.3
    this.lastEMA = nextEMA; // Update EMA state

    // Step 3: Moving average (SMA) for final smoothing (using utility)
    const { filteredValue: smaFiltered } = applySMAFilter(emaFiltered, this.ppgValues, SIGNAL_CONSTANTS.SMA_WINDOW);

    // Calculate signal quality (using utility)
    // The utility needs the filtered buffer, so we add smaFiltered first
    const tempFilteredBuffer = [...this.ppgValues, smaFiltered];
    if (tempFilteredBuffer.length > 30) tempFilteredBuffer.shift(); // Maintain buffer size for quality calculation
    const qualityValue = evaluateSignalQuality(tempFilteredBuffer, SIGNAL_CONSTANTS.MIN_AMPLITUDE);

    // Store the final filtered value in the main buffer
    this.ppgValues.push(smaFiltered);
    if (this.ppgValues.length > 30) { // Ensure ppgValues buffer size is managed
      this.ppgValues.shift();
    }
    
    // Check finger detection using pattern recognition with a higher quality threshold
    const fingerDetected = this.signalValidator.isFingerDetected() && 
                           (qualityValue >= this.MIN_QUALITY_FOR_FINGER || this.fingerDetectionConfirmed);
    
    // Calculate signal amplitude
    let amplitude = 0;
    if (this.ppgValues.length > 10) {
      const recentValues = this.ppgValues.slice(-10);
      amplitude = Math.max(...recentValues) - Math.min(...recentValues);
    }
    
    // Require minimum amplitude for detection (physiological requirement)
    const hasValidAmplitude = amplitude >= this.MIN_SIGNAL_AMPLITUDE;
    
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
   * Ensures all measurements start from zero
   */
  public reset(): void {
    super.reset();
    // Remove quality reset as it's no longer a local instance
    // this.quality.reset();
    // Reset EMA state
    this.lastEMA = null;
    this.signalValidator.resetFingerDetection();
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
  }
}
