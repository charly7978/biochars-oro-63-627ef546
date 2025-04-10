
import { BloodPressureAnalyzer, BloodPressureResult } from '../analysis/BloodPressureAnalyzer';
import { ProcessorConfig } from '../config/ProcessorConfig';

/**
 * Adapter that standardizes access to various blood pressure analysis implementations
 * This allows us to gradually migrate to a unified implementation
 */
export class BloodPressureAdapter {
  private analyzer: BloodPressureAnalyzer;
  
  constructor(config: Partial<ProcessorConfig> = {}) {
    this.analyzer = new BloodPressureAnalyzer(config);
  }
  
  /**
   * Calculate blood pressure from PPG values
   */
  public calculateBloodPressure(values: number[]): BloodPressureResult {
    return this.analyzer.estimate(values);
  }
  
  /**
   * Get the blood pressure as a formatted string
   */
  public getBloodPressureString(values: number[]): string {
    const result = this.calculateBloodPressure(values);
    return `${result.systolic}/${result.diastolic}`;
  }
  
  /**
   * Get the confidence level of the blood pressure estimation
   */
  public getConfidence(): number {
    return this.analyzer.getConfidence();
  }
  
  /**
   * Check if the blood pressure estimation is reliable
   */
  public isReliable(): boolean {
    return this.analyzer.isReliable();
  }
  
  /**
   * Reset the blood pressure analyzer
   */
  public reset(): void {
    this.analyzer.reset();
  }
}
