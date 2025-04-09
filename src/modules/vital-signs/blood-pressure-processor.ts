
import { calculateAmplitude, findPeaksAndValleys } from './utils';
import { BloodPressureAnalyzer, BloodPressureResult } from '../../core/analysis/BloodPressureAnalyzer';

export class BloodPressureProcessor {
  // Buffer size for calculations
  private readonly BP_BUFFER_SIZE = 15;
  // Measurement history
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  // Physiological boundaries
  private readonly MIN_SYSTOLIC = 80;
  private readonly MAX_SYSTOLIC = 190;
  private readonly MIN_DIASTOLIC = 50;
  private readonly MAX_DIASTOLIC = 120;
  private readonly MIN_PULSE_PRESSURE = 25;
  private readonly MAX_PULSE_PRESSURE = 70;
  // Signal quality thresholds
  private readonly MIN_SIGNAL_AMPLITUDE = 0.001;
  private readonly MIN_PEAK_COUNT = 1;
  
  // Core analyzer using direct physiological calculations
  private analyzer: BloodPressureAnalyzer;
  private lastCalculationTime: number = 0;
  private forceRecalculationInterval: number = 2000;
  
  constructor() {
    this.analyzer = new BloodPressureAnalyzer();
  }

  /**
   * Calculates blood pressure using real PPG signal features
   * Direct measurement only - no simulation
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    const currentTime = Date.now();
    
    // Basic check to ensure we have some data
    if (!values || values.length === 0) {
      console.log("BloodPressureProcessor: Empty signal received");
      return { systolic: 0, diastolic: 0 };
    }

    // Check signal quality
    const signalAmplitude = Math.max(...values) - Math.min(...values);
    if (values.length < 15 || signalAmplitude < this.MIN_SIGNAL_AMPLITUDE) {
      console.log("BloodPressureProcessor: Insufficient signal quality", {
        length: values.length,
        amplitude: signalAmplitude,
        threshold: this.MIN_SIGNAL_AMPLITUDE
      });
      return { systolic: 0, diastolic: 0 };
    }

    // Update calculation time
    this.lastCalculationTime = currentTime;

    // Use the real physiological analyzer
    const result: BloodPressureResult = this.analyzer.calculateBloodPressure(values);
    
    // Store results in buffer for stability
    if (result.systolic > 0 && result.diastolic > 0) {
      this.systolicBuffer.push(result.systolic);
      this.diastolicBuffer.push(result.diastolic);
      
      // Maintain buffer size
      if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
        this.systolicBuffer.shift();
        this.diastolicBuffer.shift();
      }
    }

    // Validate results are within physiological range
    return {
      systolic: this.validateSystolic(result.systolic),
      diastolic: this.validateDiastolic(result.diastolic, result.systolic)
    };
  }

  /**
   * Ensures systolic pressure is within physiological range
   */
  private validateSystolic(systolic: number): number {
    if (systolic <= 0) return 0;
    return Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, systolic));
  }
  
  /**
   * Ensures diastolic pressure is within physiological range
   * and maintains proper relationship with systolic
   */
  private validateDiastolic(diastolic: number, systolic: number): number {
    if (diastolic <= 0) return 0;
    
    let validDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolic));
    
    // Ensure proper differential between systolic and diastolic
    const differential = systolic - validDiastolic;
    
    if (differential < this.MIN_PULSE_PRESSURE) {
      validDiastolic = systolic - this.MIN_PULSE_PRESSURE;
    } else if (differential > this.MAX_PULSE_PRESSURE) {
      validDiastolic = systolic - this.MAX_PULSE_PRESSURE;
    }
    
    // Recheck physiological limits
    return Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, validDiastolic));
  }
  
  /**
   * Reset the blood pressure processor state
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastCalculationTime = 0;
    this.analyzer.reset();
    console.log("BloodPressureProcessor: Reset completed");
  }
}
