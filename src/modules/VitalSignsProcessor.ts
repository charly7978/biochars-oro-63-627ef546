
import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';

/**
 * Advanced auto-calibration system with progressive adaptation
 * Non-blocking implementation that allows measurements to start immediately
 * while collecting calibration data in parallel
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  private calibrationPhase: 'initial' | 'adapting' | 'calibrated' = 'initial';
  private calibrationSamples: number[] = [];
  private baselineValues: number[] = [];
  private calibrationStartTime: number | null = null;
  private lastCalibrationUpdate: number = 0;
  private lastResult: VitalSignsResult | null = null;
  
  // Optimized thresholds for reliable physiological detection
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.01; // More permissive
  private readonly SPO2_WINDOW = 3;
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 8; // More permissive
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 500; // Shorter learning period
  private readonly PEAK_THRESHOLD = 0.12; // More permissive
  private readonly CALIBRATION_SAMPLE_COUNT = 15; // Fewer samples needed
  private readonly CALIBRATION_UPDATE_INTERVAL = 300; // ms - faster updates
  private readonly CALIBRATION_TIMEOUT = 3000; // ms - shorter timeout
  
  /**
   * Constructor that initializes the internal processor
   * and prepares the calibration system
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing with non-blocking auto-calibration");
    this.processor = new CoreProcessor();
  }
  
  /**
   * Process a PPG signal and RR data to get vital signs
   * Always returns results, even during calibration
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    try {
      // Handle calibration in parallel without blocking
      this.handleCalibration(ppgValue);
      
      // Direct processing for measurements
      const result = this.processor.processSignal(ppgValue, rrData);
      
      // Store last valid result for future use
      if (result && (result.spo2 > 0 || result.pressure !== "--/--")) {
        this.lastResult = result;
      }
      
      // Always return a result, even if it's partially calibrated
      return result;
    } catch (error) {
      console.error("VitalSignsProcessor: Error processing signal:", error);
      
      // If there's an error, return the last valid result or empty values
      return this.lastResult || {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--"
      };
    }
  }
  
  /**
   * Handle the calibration process in parallel with measurements
   * Never blocks the UI thread or measurement flow
   */
  private handleCalibration(ppgValue: number): void {
    try {
      const now = Date.now();
      
      // Initialize calibration if it hasn't started
      if (this.calibrationPhase === 'initial') {
        this.calibrationPhase = 'adapting';
        this.calibrationStartTime = now;
        this.calibrationSamples = [];
        this.baselineValues = [];
        console.log("VitalSignsProcessor: Starting non-blocking calibration process");
      }
      
      // Only update calibration at specific intervals to avoid oversampling
      if (now - this.lastCalibrationUpdate < this.CALIBRATION_UPDATE_INTERVAL) {
        return;
      }
      
      this.lastCalibrationUpdate = now;
      
      // In adapting phase, collect samples
      if (this.calibrationPhase === 'adapting') {
        // More permissive sample collection
        if (Math.abs(ppgValue) > 0.005) {
          this.calibrationSamples.push(ppgValue);
          console.log("VitalSignsProcessor: Collecting calibration sample", { 
            value: ppgValue, 
            count: this.calibrationSamples.length,
            target: this.CALIBRATION_SAMPLE_COUNT
          });
        }
        
        // Check if we have enough samples or if we've timed out
        const timeInCalibration = this.calibrationStartTime ? now - this.calibrationStartTime : 0;
        
        if (this.calibrationSamples.length >= this.CALIBRATION_SAMPLE_COUNT || 
            timeInCalibration > this.CALIBRATION_TIMEOUT) {
          
          // Calculate baseline values if we have samples
          if (this.calibrationSamples.length > 0) {
            // Sort samples to find median value
            const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
            const medianIndex = Math.floor(sortedSamples.length / 2);
            const medianValue = sortedSamples[medianIndex];
            
            // Calculate average excluding outliers - more permissive
            const validSamples = sortedSamples.filter(sample => 
              Math.abs(sample - medianValue) < medianValue * 0.5 // More permissive outlier detection
            );
            
            if (validSamples.length > 0) {
              const avgValue = validSamples.reduce((sum, val) => sum + val, 0) / validSamples.length;
              this.baselineValues.push(avgValue);
              
              console.log("VitalSignsProcessor: Calibration completed", {
                samples: this.calibrationSamples.length,
                validSamples: validSamples.length,
                baseline: avgValue,
                timeInCalibration
              });
            }
          }
          
          // Mark as calibrated and continue processing
          this.calibrationPhase = 'calibrated';
        }
      }
    } catch (error) {
      console.error("VitalSignsProcessor: Error in calibration:", error);
      // Move to calibrated state to avoid blocking on error
      this.calibrationPhase = 'calibrated';
    }
  }
  
  /**
   * Return the last valid measurement results
   * Useful for saving results when stopping monitoring
   */
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastResult;
  }
  
  /**
   * Reset the processor and calibration system
   * Returns the last valid results before resetting
   */
  public reset() {
    const lastValidResults = this.lastResult;
    this.processor.reset();
    this.calibrationPhase = 'initial';
    this.calibrationSamples = [];
    this.baselineValues = [];
    this.calibrationStartTime = null;
    this.lastCalibrationUpdate = 0;
    console.log("VitalSignsProcessor: Reset complete - calibration system reset");
    return lastValidResults;
  }
  
  /**
   * Completely reset the processor and all its data
   * Removes calibration data and ensures fresh start
   */
  public fullReset(): void {
    this.lastResult = null;
    this.reset();
    this.processor.fullReset();
    console.log("VitalSignsProcessor: Full reset completed - removing all data history");
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
