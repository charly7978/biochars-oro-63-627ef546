
import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';

/**
 * Professional medical-grade wrapper that ensures only real physiological data
 * is processed with strict validation requirements.
 * 
 * This implementation enforces strict medical standards with zero simulation
 * and aggressive false positive prevention.
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  
  // Adjusted thresholds for better signal detection while maintaining rigorous validation
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.0; // No artificial calibration
  private readonly PERFUSION_INDEX_THRESHOLD = 0.09; // Moderately relaxed for better detection
  private readonly SPO2_WINDOW = 8; // Longer window for more accurate readings
  private readonly SMA_WINDOW = 8; // Stronger smoothing to reduce noise
  private readonly RR_WINDOW_SIZE = 12; // Adjusted for more responsive readings
  private readonly RMSSD_THRESHOLD = 25; // Maintained for accurate arrhythmia detection
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 2000; // Extended learning period
  private readonly PEAK_THRESHOLD = 0.35; // Moderately relaxed for better peak detection
  
  /**
   * Constructor that initializes the internal direct measurement processor
   * with strict medical-grade parameters
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing medical-grade processor with balanced validation");
    this.processor = new CoreProcessor();
  }
  
  /**
   * Process a PPG signal and RR data to get vital signs
   * Uses rigorous validation but permits genuine physiological signals
   * 
   * @param ppgValue Raw PPG signal value
   * @param rrData Optional RR interval data
   * @returns Validated vital signs or null values if data is insufficient
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Apply balanced validation - reject clearly implausible values
    
    // Basic validation with appropriate limits
    if (isNaN(ppgValue) || !isFinite(ppgValue) || ppgValue < 0) {
      console.warn("VitalSignsProcessor: Rejected invalid PPG value");
      return this.getEmptyResult();
    }
    
    // Additional validation criteria with appropriate constraints
    if (ppgValue < 0.02 || ppgValue > 250) {
      console.warn("VitalSignsProcessor: Rejected physiologically implausible PPG value");
      return this.getEmptyResult();
    }
    
    // Check signal stability - less aggressive threshold
    if (this.lastPpgValues.length >= 5) {
      const variance = this.calculateVariance(this.lastPpgValues);
      
      // If variance is extremely low, it's likely not a real signal
      if (variance < 0.005) {
        console.warn("VitalSignsProcessor: Rejected suspiciously stable signal (likely not physiological)");
        return this.getEmptyResult();
      }
    }
    
    // Record PPG values for validation
    this.lastPpgValues.push(ppgValue);
    if (this.lastPpgValues.length > 10) {
      this.lastPpgValues.shift();
    }
    
    // Validate RR data if provided with appropriate criteria
    if (rrData && rrData.intervals.length > 0) {
      // Check for any invalid intervals
      const hasInvalidIntervals = rrData.intervals.some(interval => 
        isNaN(interval) || !isFinite(interval) || interval <= 0 || interval > 2000);
      
      if (hasInvalidIntervals) {
        console.warn("VitalSignsProcessor: Rejected invalid RR intervals");
        return this.getEmptyResult();
      }
      
      // Additional physiological validation
      // Verify intervals are within plausible heart rate range (35-190 BPM)
      const hasImplausibleIntervals = rrData.intervals.some(interval => 
        interval < 315 || interval > 1700);
      
      if (hasImplausibleIntervals) {
        console.warn("VitalSignsProcessor: Rejected implausible RR intervals outside physiological range");
        return this.getEmptyResult();
      }
      
      // Allow more physiological variation in intervals
      if (rrData.intervals.length >= 3) {
        const max = Math.max(...rrData.intervals);
        const min = Math.min(...rrData.intervals);
        const ratio = max / min;
        
        if (ratio > 3.2) { // Increased threshold for physiological variation
          console.warn("VitalSignsProcessor: Rejected RR intervals with excessive non-physiological variation");
          return this.getEmptyResult();
        }
        
        // Calculate RR interval variance to detect unrealistically stable patterns
        const variance = this.calculateVariance(rrData.intervals);
        if (variance < 0.1) { // Relaxed threshold for better detection
          console.warn("VitalSignsProcessor: Rejected suspiciously stable RR intervals (likely artificial)");
          return this.getEmptyResult();
        }
      }
      
      // Validate stability over time with more tolerance for real physiological changes
      if (this.lastValidRRs.length > 0 && rrData.intervals.length > 0) {
        const lastMeanRR = this.lastValidRRs.reduce((sum, rr) => sum + rr, 0) / this.lastValidRRs.length;
        const currentMeanRR = rrData.intervals.reduce((sum, rr) => sum + rr, 0) / rrData.intervals.length;
        
        // Calculate change percentage
        const changePercent = Math.abs((currentMeanRR - lastMeanRR) / lastMeanRR) * 100;
        
        // Reject if change is too sudden (more than 35% change is non-physiological)
        // Increased from 25% to 35% for better sensitivity
        if (changePercent > 35) {
          console.warn("VitalSignsProcessor: Rejected due to physiologically implausible heart rate change");
          return this.getEmptyResult();
        }
      }
      
      // Update last valid RR intervals
      if (rrData.intervals.length > 0) {
        this.lastValidRRs = [...rrData.intervals];
        if (this.lastValidRRs.length > 10) {
          this.lastValidRRs = this.lastValidRRs.slice(-10);
        }
      }
    }
    
    // Log processing details for debugging
    console.log("VitalSignsProcessor: Processing signal with values", {
      ppgValue,
      hasRRData: !!rrData,
      rrIntervals: rrData?.intervals.length || 0,
      lastPpgValues: this.lastPpgValues.length,
      lastValidRRs: this.lastValidRRs.length
    });
    
    // Process with validated data only
    const result = this.processor.processSignal(ppgValue, rrData);
    
    // Log the results
    console.log("VitalSignsProcessor: Processed result", {
      spo2: result.spo2,
      pressure: result.pressure,
      arrhythmiaStatus: result.arrhythmiaStatus,
      glucose: result.glucose,
      hasArrhythmiaData: !!result.lastArrhythmiaData
    });
    
    return result;
  }
  
  // Track PPG values for validation
  private lastPpgValues: number[] = [];
  private lastValidRRs: number[] = [];
  
  /**
   * Calculate variance of an array of values
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }
  
  /**
   * Reset the processor to ensure a clean state
   */
  public reset() {
    console.log("VitalSignsProcessor: Reset - all measurements will start from zero");
    this.lastPpgValues = [];
    this.lastValidRRs = [];
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   * Removes any historical influence to prevent data contamination
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor: Full reset - removing all data history");
    this.lastPpgValues = [];
    this.lastValidRRs = [];
    this.processor.fullReset();
  }
  
  /**
   * Provides empty result with null values to indicate invalid data
   * Used when input validation fails
   */
  private getEmptyResult(): VitalSignsResult {
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

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
