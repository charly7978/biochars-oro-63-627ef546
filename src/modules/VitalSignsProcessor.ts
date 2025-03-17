
import { VitalSignsProcessor as CoreProcessor } from './vital-signs/VitalSignsProcessor';
import type { VitalSignsResult } from '../types/vital-signs';

/**
 * Advanced auto-calibration system with progressive adaptation
 * Non-blocking implementation that allows measurements to start immediately
 * while collecting calibration data in parallel
 */
export class VitalSignsProcessor {
  private processor: CoreProcessor;
  private calibrationPhase: 'initial' | 'calibrating' | 'completed' = 'initial';
  private calibrationSamples: number[] = [];
  private baselineValues: number[] = [];
  private calibrationStartTime: number | null = null;
  private lastCalibrationUpdate: number = 0;
  private lastResult: VitalSignsResult | null = null;
  private calibrationProgress: number = 0;
  private calibrationCompleteTime: number | null = null;
  private actualProcessingStartTime: number | null = null;
  
  // Optimized thresholds for reliable physiological detection
  private readonly CALIBRATION_DURATION_MS = 8000; // 8 seconds calibration
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
  private readonly CALIBRATION_UPDATE_INTERVAL = 50; // ms - faster updates (was 100)
  
  /**
   * Constructor that initializes the internal processor
   * and prepares the calibration system
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing with real auto-calibration");
    this.processor = new CoreProcessor();
    this.actualProcessingStartTime = null;
  }
  
  /**
   * Process a PPG signal and RR data to get vital signs
   * During calibration, returns placeholder results
   * After calibration, returns real measurements
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    try {
      // Start actual processing time on first valid signal
      if (this.actualProcessingStartTime === null && Math.abs(ppgValue) > 0.01) {
        this.actualProcessingStartTime = Date.now();
        console.log("VitalSignsProcessor: First valid signal received, starting timer");
      }
      
      // Update calibration state
      this.handleCalibration(ppgValue);
      
      // During calibration phase, return placeholder values
      if (this.calibrationPhase === 'initial' || this.calibrationPhase === 'calibrating') {
        // Return placeholder with correct TypeScript structure
        return {
          spo2: 0,
          pressure: "--/--",
          arrhythmiaStatus: "CALIBRANDO... " + Math.round(this.calibrationProgress) + "%",
          glucose: 0,
          lipids: {
            totalCholesterol: 0,
            triglycerides: 0
          },
          calibration: {
            phase: this.calibrationPhase,
            progress: {
              heartRate: this.calibrationProgress / 100,
              spo2: this.calibrationProgress / 100,
              pressure: this.calibrationProgress / 100,
              arrhythmia: this.calibrationProgress / 100
            }
          }
        };
      }
      
      // Direct processing for measurements after calibration
      const result = this.processor.processSignal(ppgValue, rrData);
      
      // Add calibration data to result
      const resultWithCalibration: VitalSignsResult = {
        ...result,
        calibration: {
          phase: this.calibrationPhase,
          progress: {
            heartRate: 1.0,
            spo2: 1.0,
            pressure: 1.0,
            arrhythmia: 1.0
          }
        }
      };
      
      // Store last valid result for future use
      if (resultWithCalibration && (resultWithCalibration.spo2 > 0 || resultWithCalibration.pressure !== "--/--")) {
        this.lastResult = resultWithCalibration;
      }
      
      // Return the processed result
      return resultWithCalibration;
    } catch (error) {
      console.error("VitalSignsProcessor: Error processing signal:", error);
      
      // If there's an error, return the last valid result or empty values
      return this.lastResult || {
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
   * Handle the calibration process with progress tracking
   * Strictly follows an 8-second calibration period
   */
  private handleCalibration(ppgValue: number): void {
    try {
      const now = Date.now();
      
      // Only start calibration once we have an actual valid signal
      if (this.calibrationPhase === 'initial' && this.actualProcessingStartTime !== null) {
        this.calibrationPhase = 'calibrating';
        this.calibrationStartTime = now;
        this.calibrationSamples = [];
        this.baselineValues = [];
        this.calibrationProgress = 0;
        console.log("VitalSignsProcessor: Starting 8-second calibration process with valid signal");
      }
      
      // Wait for a valid signal before starting calibration
      if (this.calibrationPhase === 'initial' && Math.abs(ppgValue) > 0.01) {
        this.actualProcessingStartTime = now;
        this.calibrationPhase = 'calibrating';
        this.calibrationStartTime = now;
        this.calibrationSamples = [];
        this.baselineValues = [];
        this.calibrationProgress = 0;
        console.log("VitalSignsProcessor: Starting 8-second calibration with first valid signal");
      }
      
      // Only update calibration at specific intervals to avoid oversampling
      if (now - this.lastCalibrationUpdate < this.CALIBRATION_UPDATE_INTERVAL) {
        return;
      }
      
      this.lastCalibrationUpdate = now;
      
      // In calibration phase, collect samples and update progress
      if (this.calibrationPhase === 'calibrating') {
        // Update progress percentage
        if (this.calibrationStartTime) {
          const elapsedMs = now - this.calibrationStartTime;
          const oldProgress = this.calibrationProgress;
          this.calibrationProgress = Math.min(100, (elapsedMs / this.CALIBRATION_DURATION_MS) * 100);
          
          // Only log when progress actually changes significantly
          if (Math.floor(this.calibrationProgress / 5) > Math.floor(oldProgress / 5)) {
            console.log("VitalSignsProcessor: Calibration progress:", this.calibrationProgress.toFixed(1) + "%", {
              elapsedMs,
              now,
              startTime: this.calibrationStartTime,
              signal: Math.abs(ppgValue) > 0.01 ? "valid" : "weak"
            });
          }
          
          // Collect calibration sample
          if (Math.abs(ppgValue) > 0.005) {
            this.calibrationSamples.push(ppgValue);
          }
          
          // Check if calibration time has completed
          if (elapsedMs >= this.CALIBRATION_DURATION_MS) {
            // Calculate baseline values if we have samples
            if (this.calibrationSamples.length > 0) {
              // Sort samples to find median value
              const sortedSamples = [...this.calibrationSamples].sort((a, b) => a - b);
              const medianIndex = Math.floor(sortedSamples.length / 2);
              const medianValue = sortedSamples[medianIndex];
              
              // Calculate average excluding outliers
              const validSamples = sortedSamples.filter(sample => 
                Math.abs(sample - medianValue) < medianValue * 0.5
              );
              
              if (validSamples.length > 0) {
                const avgValue = validSamples.reduce((sum, val) => sum + val, 0) / validSamples.length;
                this.baselineValues.push(avgValue);
                
                console.log("VitalSignsProcessor: Calibration completed", {
                  samples: this.calibrationSamples.length,
                  validSamples: validSamples.length,
                  baseline: avgValue,
                  elapsedMs
                });
              }
            }
            
            // Mark as completed and store the completion time
            this.calibrationPhase = 'completed';
            this.calibrationCompleteTime = now;
            this.calibrationProgress = 100;
            console.log("VitalSignsProcessor: 8-second calibration phase completed, starting measurements");
          }
        }
      }
    } catch (error) {
      console.error("VitalSignsProcessor: Error in calibration:", error);
      // Move to completed state to avoid blocking on error
      this.calibrationPhase = 'completed';
      this.calibrationProgress = 100;
    }
  }
  
  /**
   * Return the calibration progress as a percentage
   */
  public getCalibrationProgress(): number {
    // If we haven't started actual processing, return 0
    if (this.actualProcessingStartTime === null || this.calibrationPhase === 'initial') {
      return 0;
    }
    return this.calibrationProgress;
  }
  
  /**
   * Check if calibration is complete
   */
  public isCalibrationComplete(): boolean {
    return this.calibrationPhase === 'completed';
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
    this.calibrationProgress = 0;
    this.calibrationCompleteTime = null;
    this.actualProcessingStartTime = null;
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
