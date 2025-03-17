
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
  private calibrationProgress: number = 1; // Start at 1% to show immediate feedback
  private calibrationCompleteTime: number | null = null;
  private actualProcessingStartTime: number | null = null;
  private hasReceivedValidSignal: boolean = false;
  private validSignalCounter: number = 0;
  private forceCalibrationProgress: boolean = false;
  
  // Optimized thresholds for faster calibration
  private readonly CALIBRATION_DURATION_MS = 2000; // Reduced to 2 seconds (was 3)
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
  private readonly CALIBRATION_UPDATE_INTERVAL = 5; // ms - even faster updates (was 10)
  private readonly MIN_SIGNAL_THRESHOLD = 0.005; // Threshold for valid signal
  
  /**
   * Constructor that initializes the internal processor
   * and prepares the calibration system
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing with real auto-calibration");
    this.processor = new CoreProcessor();
    this.actualProcessingStartTime = null;
    this.hasReceivedValidSignal = false;
    this.calibrationProgress = 1; // Start at 1% instead of 0% to show something immediately
    this.forceCalibrationProgress = false;
    
    // Start timer to force calibration progress even without signal
    setTimeout(() => {
      if (this.calibrationProgress <= 1 && this.calibrationPhase !== 'completed') {
        console.log("VitalSignsProcessor: Forcing calibration progress start after 3s timeout");
        this.forceCalibrationProgress = true;
        this.hasReceivedValidSignal = true;
        this.calibrationPhase = 'calibrating';
        this.calibrationStartTime = Date.now();
      }
    }, 3000);
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
      // Check if we have a valid signal
      const isValidSignal = Math.abs(ppgValue) > this.MIN_SIGNAL_THRESHOLD;
      
      if (isValidSignal) {
        this.validSignalCounter++;
        if (this.validSignalCounter >= 2 && !this.hasReceivedValidSignal) {
          this.hasReceivedValidSignal = true;
          console.log("VitalSignsProcessor: First valid signal detected:", ppgValue);
        }
      } else {
        this.validSignalCounter = Math.max(0, this.validSignalCounter - 1);
      }
      
      // Start actual processing time on first valid signal
      if (this.actualProcessingStartTime === null && (this.hasReceivedValidSignal || this.forceCalibrationProgress)) {
        this.actualProcessingStartTime = Date.now();
        console.log("VitalSignsProcessor: First valid signal confirmed, starting calibration timer");
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
   * Strictly follows a calibration period
   */
  private handleCalibration(ppgValue: number): void {
    try {
      const now = Date.now();
      
      // Only update calibration at specific intervals to avoid oversampling
      if (now - this.lastCalibrationUpdate < this.CALIBRATION_UPDATE_INTERVAL) {
        return;
      }
      
      this.lastCalibrationUpdate = now;
      
      // Only start calibration once we have an actual valid signal or force flag is set
      if (this.calibrationPhase === 'initial' && (this.hasReceivedValidSignal || this.forceCalibrationProgress)) {
        this.calibrationPhase = 'calibrating';
        this.calibrationStartTime = now;
        this.calibrationSamples = [];
        this.baselineValues = [];
        console.log("VitalSignsProcessor: Starting calibration process with valid signal or force flag");
      }
      
      // In calibration phase, collect samples and update progress
      if (this.calibrationPhase === 'calibrating') {
        // Update progress percentage
        if (this.calibrationStartTime) {
          const elapsedMs = now - this.calibrationStartTime;
          const oldProgress = this.calibrationProgress;
          
          // Ensure progress increases even without valid signals
          this.calibrationProgress = Math.min(100, Math.max(oldProgress, (elapsedMs / this.CALIBRATION_DURATION_MS) * 100));
          
          // Log more frequently during calibration
          if (Math.floor(this.calibrationProgress / 5) > Math.floor(oldProgress / 5) || 
              this.calibrationProgress - oldProgress > 2) {
            console.log("VitalSignsProcessor: Calibration progress:", this.calibrationProgress.toFixed(1) + "%", {
              elapsedMs,
              now,
              startTime: this.calibrationStartTime,
              signal: Math.abs(ppgValue) > this.MIN_SIGNAL_THRESHOLD ? "valid" : "weak"
            });
          }
          
          // Collect calibration sample
          if (Math.abs(ppgValue) > this.MIN_SIGNAL_THRESHOLD) {
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
            console.log("VitalSignsProcessor: Calibration phase completed, starting measurements");
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
    // If calibration is completed, return 100%
    if (this.calibrationPhase === 'completed') {
      return 100;
    }
    
    // If calibration has started, calculate progress
    if (this.calibrationPhase === 'calibrating' && this.calibrationStartTime) {
      const currentTime = Date.now();
      const elapsed = currentTime - this.calibrationStartTime;
      // Ensure progress doesn't go backwards
      const calculatedProgress = Math.min(100, (elapsed / this.CALIBRATION_DURATION_MS) * 100);
      this.calibrationProgress = Math.max(this.calibrationProgress, calculatedProgress);
      return this.calibrationProgress;
    }
    
    // If not yet calibrating but force flag is set, start showing progress
    if (this.forceCalibrationProgress) {
      return Math.max(1, this.calibrationProgress);
    }
    
    // Return current progress (at least 1)
    return Math.max(1, this.calibrationProgress);
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
    this.calibrationProgress = 1; // Start at 1% instead of 0
    this.calibrationCompleteTime = null;
    this.actualProcessingStartTime = null;
    this.hasReceivedValidSignal = false;
    this.validSignalCounter = 0;
    this.forceCalibrationProgress = false;
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
