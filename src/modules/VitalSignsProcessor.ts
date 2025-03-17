
import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';

/**
 * Compatibility wrapper that maintains the original interface
 * while using direct measurement implementation.
 * 
 * This file ensures all measurements start from zero and use only real data.
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  
  // Significantly adjusted thresholds to reduce false positives
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.0; // Neutral calibration factor
  private readonly PERFUSION_INDEX_THRESHOLD = 0.05; // Doubled threshold for much stricter finger detection
  private readonly SPO2_WINDOW = 7; // Increased window for more data points before confirming
  private readonly SMA_WINDOW = 5; // Increased for better smoothing
  private readonly RR_WINDOW_SIZE = 8; // Increased window size for more reliable detection
  private readonly RMSSD_THRESHOLD = 20; // Increased for stricter arrhythmia detection
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 1500; // Extended learning period
  private readonly PEAK_THRESHOLD = 0.35; // Significantly increased for fewer false positives
  
  // Enhanced parameters to drastically reduce false positives
  private readonly MIN_CONSECUTIVE_DETECTIONS = 5; // Require more consecutive detections (was 3)
  private consecutiveDetections: number = 0;
  private readonly FALSE_POSITIVE_GUARD_PERIOD = 800; // Increased guard period (was 500)
  private lastDetectionTime: number = 0;
  
  // New signal validation parameters
  private readonly MIN_SIGNAL_AMPLITUDE = 12.0; // Minimum amplitude for a valid PPG signal
  private readonly MAX_SIGNAL_AMPLITUDE = 150.0; // Maximum amplitude for a valid PPG signal
  private readonly SIGNAL_VARIANCE_THRESHOLD = 8.0; // Minimum variance for heartbeat-like patterns
  private readonly MIN_SIGNAL_QUALITY = 40; // Minimum quality score to be considered valid
  private signalQualityScore: number = 0;
  private recentValues: number[] = [];
  private readonly RECENT_VALUES_SIZE = 15; // Increased window for pattern detection
  
  /**
   * Constructor that initializes the internal direct measurement processor
   */
  constructor() {
    console.log("VitalSignsProcessor wrapper: Initializing with direct measurement mode");
    this.processor = new CoreProcessor();
  }
  
  /**
   * Process a PPG signal and RR data to get vital signs
   * Maintains exactly the same method signature for compatibility
   * Always performs direct measurement with no reference values
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Update recent values for pattern analysis
    this.updateRecentValues(ppgValue);
    
    // Apply enhanced verification before forwarding signal
    // This helps drastically reduce false positives in finger detection
    
    const now = Date.now();
    const timeSinceLastDetection = now - this.lastDetectionTime;
    
    // Calculate signal quality score based on multiple factors
    this.updateSignalQualityScore();
    
    // Check if the signal passes enhanced verification with stricter criteria
    const signalVerified = this.verifySignal(ppgValue);
    
    // Update detection counters based on verification
    // More strict updating to require consistent good signal
    if (signalVerified) {
      // Slower increase for positive detections
      this.consecutiveDetections = Math.min(this.MIN_CONSECUTIVE_DETECTIONS + 3, this.consecutiveDetections + 1);
      this.lastDetectionTime = now;
    } else {
      // Much faster decrease for negative detections
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1.5);
    }
    
    // Log verification status periodically
    if (Math.random() < 0.05) {
      console.log("VitalSignsProcessor: Verification status", {
        signalVerified,
        consecutiveDetections: this.consecutiveDetections,
        requiredDetections: this.MIN_CONSECUTIVE_DETECTIONS,
        qualityScore: this.signalQualityScore,
        recentValuesCount: this.recentValues.length
      });
    }
    
    // Only process signal if we have sufficient consecutive detections
    // or we're within the guard period of a previous valid detection
    const shouldProcess = 
      this.consecutiveDetections >= this.MIN_CONSECUTIVE_DETECTIONS ||
      (this.consecutiveDetections > 0 && timeSinceLastDetection < this.FALSE_POSITIVE_GUARD_PERIOD);
    
    if (shouldProcess) {
      return this.processor.processSignal(ppgValue, rrData);
    } else {
      // Return a null result without processing when detection is uncertain
      // This maintains the same return type but avoids processing unreliable data
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        }
      };
    }
  }
  
  /**
   * Update the recent values buffer for signal analysis
   */
  private updateRecentValues(value: number): void {
    this.recentValues.push(value);
    if (this.recentValues.length > this.RECENT_VALUES_SIZE) {
      this.recentValues.shift();
    }
  }
  
  /**
   * Calculate and update signal quality score based on multiple factors
   */
  private updateSignalQualityScore(): void {
    if (this.recentValues.length < 10) {
      this.signalQualityScore = 0;
      return;
    }
    
    // Factor 1: Signal variance - PPG should have clear pulsatile pattern
    const mean = this.recentValues.reduce((sum, val) => sum + val, 0) / this.recentValues.length;
    const variance = this.recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.recentValues.length;
    const varianceScore = variance > this.SIGNAL_VARIANCE_THRESHOLD ? 100 : variance / this.SIGNAL_VARIANCE_THRESHOLD * 100;
    
    // Factor 2: Signal amplitude - too low or too high is suspicious
    const min = Math.min(...this.recentValues);
    const max = Math.max(...this.recentValues);
    const amplitude = max - min;
    let amplitudeScore = 0;
    
    if (amplitude >= this.MIN_SIGNAL_AMPLITUDE && amplitude <= this.MAX_SIGNAL_AMPLITUDE) {
      // Optimal range
      amplitudeScore = 100;
    } else if (amplitude < this.MIN_SIGNAL_AMPLITUDE) {
      // Too low - likely no finger
      amplitudeScore = (amplitude / this.MIN_SIGNAL_AMPLITUDE) * 80;
    } else {
      // Too high - likely motion artifact
      amplitudeScore = Math.max(0, 100 - ((amplitude - this.MAX_SIGNAL_AMPLITUDE) / 50) * 100);
    }
    
    // Factor 3: Cross-zero rate - real PPG signals cross the mean at a certain rate
    let crossings = 0;
    for (let i = 1; i < this.recentValues.length; i++) {
      if ((this.recentValues[i] > mean && this.recentValues[i-1] < mean) || 
          (this.recentValues[i] < mean && this.recentValues[i-1] > mean)) {
        crossings++;
      }
    }
    
    // Expect 2-5 crossings in a normal heart rate window
    const crossingScore = (crossings >= 2 && crossings <= 7) ? 100 : Math.max(0, 100 - Math.abs(crossings - 4) * 20);
    
    // Combined score
    this.signalQualityScore = Math.round(
      (varianceScore * 0.4) + 
      (amplitudeScore * 0.4) + 
      (crossingScore * 0.2)
    );
  }
  
  /**
   * Enhanced signal verification method to reduce false positives
   * Uses multiple verification criteria that are characteristic of real PPG signals
   */
  private verifySignal(ppgValue: number): boolean {
    // Basic validation: reject unreasonable values
    if (ppgValue < 0 || ppgValue > 255 || isNaN(ppgValue)) {
      return false;
    }
    
    // Reject if we don't have enough data for analysis
    if (this.recentValues.length < 10) {
      return false;
    }
    
    // Check overall signal quality score
    if (this.signalQualityScore < this.MIN_SIGNAL_QUALITY) {
      return false;
    }
    
    // Calculate min, max, and range
    const min = Math.min(...this.recentValues);
    const max = Math.max(...this.recentValues);
    const range = max - min;
    
    // Check for reasonable signal amplitude
    if (range < this.MIN_SIGNAL_AMPLITUDE || range > this.MAX_SIGNAL_AMPLITUDE) {
      return false;
    }
    
    // Real PPG signals have characteristic patterns of changes
    // Check for sudden large jumps which are unlikely in real PPG
    for (let i = 1; i < this.recentValues.length; i++) {
      const delta = Math.abs(this.recentValues[i] - this.recentValues[i-1]);
      // Reject if any adjacent samples change by more than 40% of the total range
      if (delta > range * 0.4) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Reset the processor
   * Ensures all measurements start from zero
   */
  public reset() {
    console.log("VitalSignsProcessor wrapper: Reset - all measurements will start from zero");
    this.consecutiveDetections = 0;
    this.lastDetectionTime = 0;
    this.recentValues = [];
    this.signalQualityScore = 0;
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   * Removes any history and ensures fresh start
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor wrapper: Full reset - removing all data history");
    this.consecutiveDetections = 0;
    this.lastDetectionTime = 0;
    this.recentValues = [];
    this.signalQualityScore = 0;
    this.processor.fullReset();
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
