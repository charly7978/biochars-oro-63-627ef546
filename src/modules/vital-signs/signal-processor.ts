/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseProcessor } from './processors/base-processor';
import { SignalFilter } from './processors/signal-filter';
import { SignalQuality } from './processors/signal-quality';
import { HeartRateDetector } from './processors/heart-rate-detector';
import { SignalValidator } from './validators/signal-validator';

// Define the main buffer size needed for analyses
const MAIN_BUFFER_SIZE = 300; // Approx 10 seconds at 30Hz

/**
 * Signal processor for real PPG signals
 * Centralizes buffer management and basic processing.
 */
export class SignalProcessor extends BaseProcessor {
  private filter: SignalFilter;
  private quality: SignalQuality;
  private heartRateDetector: HeartRateDetector;
  private signalValidator: SignalValidator; // Keep validator for finger detection
  
  // Centralized buffer for filtered PPG values
  // this.ppgValues comes from BaseProcessor, ensure its size here
  
  // Finger detection state (can likely be simplified or moved to validator)
  private rhythmBasedFingerDetection: boolean = false;
  private fingerDetectionConfirmed: boolean = false;
  private fingerDetectionStartTime: number | null = null;
  
  // Signal quality variables - thresholds can be tuned
  private readonly MIN_QUALITY_FOR_FINGER = 45;
  private readonly MIN_PATTERN_CONFIRMATION_TIME = 1500;
  private readonly MIN_SIGNAL_AMPLITUDE = 0.05;
  
  constructor() {
    super(); // Initializes this.ppgValues = []
    this.filter = new SignalFilter();
    this.quality = new SignalQuality();
    this.heartRateDetector = new HeartRateDetector();
    this.signalValidator = new SignalValidator(0.02, 15); 
    // Initialize buffer with correct size (optional, will grow)
    // this.ppgValues.length = MAIN_BUFFER_SIZE;
    // this.ppgValues.fill(0); // Or some initial value
  }
  
  /**
   * Processes a new raw PPG value: applies filter and updates the main buffer.
   * @param rawValue The raw PPG value.
   * @returns The filtered value.
   */
  public processNewValue(rawValue: number): number {
      const filteredValue = this.filter.applySMAFilter(rawValue, this.ppgValues); // SMA uses last 5 points from buffer
      
      // Update the centralized buffer
      this.ppgValues.push(filteredValue);
      if (this.ppgValues.length > MAIN_BUFFER_SIZE) {
        this.ppgValues.shift(); // Keep buffer size constrained
      }
      
      // Track signal for finger pattern detection
      this.signalValidator.trackSignalForPatternDetection(rawValue); // Track raw value for patterns
      this.updateFingerDetectionStatus(); // Update internal finger detection state

      return filteredValue;
  }

  /**
   * Updates the internal finger detection state based on amplitude of filtered signal.
   * TEMPORARILY Simplified for debugging camera instability.
   */
  private updateFingerDetectionStatus(): void {
       // Calculate amplitude on recent filtered values
       let amplitude = 0;
       const recentFiltered = this.ppgValues.slice(-30);
       if (recentFiltered.length > 10) { 
         amplitude = Math.max(...recentFiltered) - Math.min(...recentFiltered);
       }
       const hasValidAmplitude = amplitude >= this.MIN_SIGNAL_AMPLITUDE; // Using the adjusted 0.05 threshold

       // --- Simplified Logic --- 
       this.fingerDetectionConfirmed = hasValidAmplitude; // Directly use amplitude check
       // Reset confirmation timer logic is bypassed for now
       if (!hasValidAmplitude && this.fingerDetectionStartTime !== null) {
           // Reset start time if amplitude is lost
           this.fingerDetectionStartTime = null; 
       } else if (hasValidAmplitude && this.fingerDetectionStartTime === null) {
           // Set start time if amplitude is detected (though timer not used currently)
           this.fingerDetectionStartTime = Date.now();
       }
       // Bypassing quality and pattern check for now
  }

  /**
   * Returns the current finger detection status (Simplified: based on amplitude).
   */
  public isFingerDetected(): boolean {
      // Directly return the state updated by updateFingerDetectionStatus
      return this.fingerDetectionConfirmed;
  }
  
  /**
   * Returns the main buffer of filtered PPG values.
   * Consumers should treat this as read-only or use slices.
   */
  public getFilteredPPGValues(): number[] {
      return this.ppgValues; // Return reference to the main buffer
  }

  // --- Remove deprecated filter methods if VitalSignsProcessor uses processNewValue --- 
  // public applySMAFilter(value: number): number { ... } 
  // public applyEMAFilter(value: number, alpha?: number): number { ... }
  // public applyMedianFilter(value: number): number { ... }
  // public applyFilters(value: number): { ... } // This complex one should definitely be removed or refactored
  
  /**
   * Calculate heart rate from the filtered PPG values buffer.
   */
  public calculateHeartRate(sampleRate: number = 30): number {
    // Use the internal, managed buffer
    return this.heartRateDetector.calculateHeartRate(this.ppgValues, sampleRate);
  }
  
  /**
   * Reset the signal processor
   */
  public reset(): void {
    super.reset(); // Resets this.ppgValues = []
    this.quality.reset();
    this.signalValidator.resetFingerDetection();
    this.fingerDetectionConfirmed = false;
    this.fingerDetectionStartTime = null;
    this.rhythmBasedFingerDetection = false;
    console.log("SignalProcessor Reset");
  }
}
