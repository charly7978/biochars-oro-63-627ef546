/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalFilter } from '@/core/signal-processing/filters/SignalFilter';
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
  
  // Define filter parameters used in this processor
  private readonly MEDIAN_WINDOW_SIZE = 3; // Example: Specific value for this processor
  private readonly EMA_ALPHA = 0.2;         // Example: Specific value for this processor
  private readonly SMA_WINDOW_SIZE = 5;         // Example: Specific value for this processor
  
  constructor() {
    super();
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
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
   * No simulation is used
   * Incorporates rhythmic pattern-based finger detection
   */
  public applyFilters(value: number): { filteredValue: number, quality: number, fingerDetected: boolean } {
    // Track the signal for pattern detection
    this.signalValidator.trackSignalForPatternDetection(value);
    
    // Get recent values needed for filters (using processor-specific window sizes)
    const medianRecentBuffer = this.ppgValues.length >= this.MEDIAN_WINDOW_SIZE - 1
                             ? this.ppgValues.slice(-(this.MEDIAN_WINDOW_SIZE - 1))
                             : [];
     const smaRecentBuffer = this.ppgValues.length >= this.SMA_WINDOW_SIZE - 1
                             ? this.ppgValues.slice(-(this.SMA_WINDOW_SIZE - 1))
                             : [];
    
    // Step 1: Median filter to remove outliers
    const medianFiltered = this.filter.applyMedianFilter(value, medianRecentBuffer, this.MEDIAN_WINDOW_SIZE);
    
    // Step 2: Low pass filter (EMA) to smooth the signal
    const lowPassFiltered = this.filter.applyEMAFilter(medianFiltered, this.EMA_ALPHA);
    
    // Step 3: Moving average for final smoothing
    const smaFiltered = this.filter.applySMAFilter(lowPassFiltered, smaRecentBuffer, this.SMA_WINDOW_SIZE);
    
    // Calculate noise level of real signal
    this.quality.updateNoiseLevel(value, smaFiltered);
    
    // Calculate signal quality (0-100)
    const qualityValue = this.quality.calculateSignalQuality(this.ppgValues);
    
    // Store the filtered value in the processor's main buffer
    this.ppgValues.push(smaFiltered);
    // Keep buffer size manageable (e.g., 30 seconds at 30Hz = 900? Adjust as needed)
    // Using a smaller buffer for general processing, maybe 60?
    const MAX_BUFFER_SIZE = 60;
    if (this.ppgValues.length > MAX_BUFFER_SIZE) {
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
    this.filter.reset();
    this.quality.reset();
    this.signalValidator.resetFingerDetection();
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
  }
}
