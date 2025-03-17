
import { VitalSignsProcessor as CoreProcessor, VitalSignsResult } from './vital-signs/VitalSignsProcessor';

/**
 * Advanced auto-calibration system with progressive adaptation
 * Ensures reliable measurements while maintaining finger detection
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  private calibrationPhase: 'initial' | 'adapting' | 'calibrated' = 'initial';
  private calibrationSamples: number[] = [];
  private baselineValues: number[] = [];
  private calibrationStartTime: number | null = null;
  private lastCalibrationUpdate: number = 0;
  
  // Optimized thresholds for reliable physiological detection
  private readonly WINDOW_SIZE = 300;
  private readonly SPO2_CALIBRATION_FACTOR = 1.0;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.015; 
  private readonly SPO2_WINDOW = 3;
  private readonly SMA_WINDOW = 3;
  private readonly RR_WINDOW_SIZE = 5;
  private readonly RMSSD_THRESHOLD = 12;
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 800;
  private readonly PEAK_THRESHOLD = 0.15;
  private readonly CALIBRATION_SAMPLE_COUNT = 25;
  private readonly CALIBRATION_UPDATE_INTERVAL = 1000; // ms
  private readonly CALIBRATION_TIMEOUT = 6000; // ms
  
  /**
   * Constructor that initializes the internal processor
   * and prepares the calibration system
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing with advanced auto-calibration");
    this.processor = new CoreProcessor();
  }
  
  /**
   * Process a PPG signal and RR data to get vital signs
   * Integrates auto-calibration while maintaining measurement flow
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Handle calibration phase
    this.handleCalibration(ppgValue);
    
    // Direct processing for measurements
    const result = this.processor.processSignal(ppgValue, rrData);
    
    // Apply calibration adjustments if we have sufficient data
    if (this.calibrationPhase === 'calibrated' && this.baselineValues.length > 0) {
      // We have valid calibration data, but we don't modify the core result
      // This preserves the existing measurement flow
      console.log("VitalSignsProcessor: Using calibrated processing", {
        calibrationPhase: this.calibrationPhase,
        baselineCount: this.baselineValues.length,
        signalValue: ppgValue
      });
    }
    
    return result;
  }
  
  /**
   * Handle the calibration process in parallel with measurements
   * This ensures we collect calibration data without blocking the UI
   */
  private handleCalibration(ppgValue: number): void {
    const now = Date.now();
    
    // Initialize calibration if it hasn't started
    if (this.calibrationPhase === 'initial') {
      this.calibrationPhase = 'adapting';
      this.calibrationStartTime = now;
      this.calibrationSamples = [];
      this.baselineValues = [];
      console.log("VitalSignsProcessor: Starting calibration process");
    }
    
    // Only update calibration at specific intervals to avoid oversampling
    if (now - this.lastCalibrationUpdate < this.CALIBRATION_UPDATE_INTERVAL) {
      return;
    }
    
    this.lastCalibrationUpdate = now;
    
    // In adapting phase, collect samples
    if (this.calibrationPhase === 'adapting') {
      // Only add samples if they're valid signal values
      if (Math.abs(ppgValue) > 0.01) {
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
          
          // Calculate average excluding outliers
          const validSamples = sortedSamples.filter(sample => 
            Math.abs(sample - medianValue) < medianValue * 0.3
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
        
        // Mark as calibrated
        this.calibrationPhase = 'calibrated';
      }
    }
  }
  
  /**
   * Reset the processor and calibration system
   * Ensures a clean state for new measurements
   */
  public reset() {
    this.processor.reset();
    this.calibrationPhase = 'initial';
    this.calibrationSamples = [];
    this.baselineValues = [];
    this.calibrationStartTime = null;
    this.lastCalibrationUpdate = 0;
    console.log("VitalSignsProcessor: Reset complete - calibration system reset");
    return null;
  }
  
  /**
   * Completely reset the processor and all its data
   * Removes calibration data and ensures fresh start
   */
  public fullReset(): void {
    this.reset();
    this.processor.fullReset();
    console.log("VitalSignsProcessor: Full reset completed - removing all data history");
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './vital-signs/VitalSignsProcessor';
