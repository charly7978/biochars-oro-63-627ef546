
/**
 * Simplified blood pressure processor without any value constraints
 */
import { BloodPressureResult } from './BloodPressureResult';
import { calculateMAP, validateBloodPressure, formatBloodPressure, categorizeBloodPressure } from './BloodPressureUtils';

/**
 * Processes PPG signals to extract blood pressure values
 * using direct measurement with more moderate amplification
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
   * Showing raw values with moderate amplification
   */
  public process(value: number): BloodPressureResult {
    // Direct calculation with moderate amplification
    const result = this.directCalculation(value);
    
    // Store result without validation
    this.lastValidResult = result;
    
    // Return the direct result
    return result;
  }
  
  /**
   * Calculate blood pressure directly from signal value
   * with moderate amplification
   */
  private directCalculation(value: number): BloodPressureResult {
    // Direct multiplication of signal with moderate amplification factors
    const signalAmplitude = Math.abs(value);
    
    // Calculate systolic and diastolic with moderate amplification
    // Starting from typical baseline values
    const systolic = Math.round(120 + value * 15); // reduced from 40
    const diastolic = Math.round(80 + value * 10); // reduced from 30
    const map = calculateMAP(systolic, diastolic);
    
    // Get category without constraining the values
    const category = categorizeBloodPressure(systolic, diastolic);
    
    return {
      systolic,
      diastolic,
      map,
      category,
      confidence: signalAmplitude * 2 // Simple confidence based on signal strength
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
