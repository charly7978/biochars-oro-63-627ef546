
/**
 * Simplified blood pressure processor without any value constraints
 */
import { BloodPressureResult } from './BloodPressureResult';
import { calculateMAP, validateBloodPressure, formatBloodPressure, categorizeBloodPressure } from './BloodPressureUtils';

/**
 * Processes PPG signals to extract blood pressure values
 * using direct measurement with MAXIMUM raw amplification
 */
export class BloodPressureProcessor {
  private lastValidResult: BloodPressureResult | null = null;
  private processingOptions: {
    useEnhancement: boolean;
    confidenceThreshold: number;
    traditionalWeight: number;
  };
  
  constructor(options?: {
    useEnhancement?: boolean;
    confidenceThreshold?: number;
    traditionalWeight?: number;
  }) {
    this.processingOptions = {
      useEnhancement: options?.useEnhancement ?? true,
      confidenceThreshold: options?.confidenceThreshold ?? 0.5,
      traditionalWeight: options?.traditionalWeight ?? 0.4
    };
  }
  
  /**
   * Process a PPG signal to extract blood pressure
   * Showing RAW values with MAXIMUM amplification
   */
  public process(value: number): BloodPressureResult {
    // Direct calculation with MAXIMUM amplification
    const result = this.directCalculation(value);
    
    // Store result without validation
    this.lastValidResult = result;
    
    // Return the direct result
    return result;
  }
  
  /**
   * Calculate blood pressure directly from signal value
   * with MAXIMUM amplification
   */
  private directCalculation(value: number): BloodPressureResult {
    // Direct multiplication of signal with MAXIMUM amplification factors
    const signalAmplitude = Math.abs(value);
    
    // Calculate systolic and diastolic with MAXIMUM amplification
    // Starting from typical baseline values
    const systolic = Math.round(120 + value * 80); // increased amplification
    const diastolic = Math.round(80 + value * 60); // increased amplification
    const map = calculateMAP(systolic, diastolic);
    
    // Get category without constraining the values
    const category = categorizeBloodPressure(systolic, diastolic);
    
    return {
      systolic,
      diastolic,
      map,
      category,
      confidence: signalAmplitude * 3 // Simple confidence based on signal strength
    };
  }
  
  /**
   * Get the last valid result
   */
  public getLastValidResult(): BloodPressureResult | null {
    return this.lastValidResult;
  }
  
  /**
   * Get the confidence score of the latest measurement
   */
  public getConfidence(): number {
    return this.lastValidResult?.confidence ?? 0;
  }
  
  /**
   * Update processing options
   */
  public updateOptions(options: Partial<typeof this.processingOptions>): void {
    this.processingOptions = { ...this.processingOptions, ...options };
  }

  /**
   * Reset the processor to initial state
   */
  public reset(): void {
    this.lastValidResult = null;
  }
}
