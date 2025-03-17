
import { ValidationConfig } from '../ValidationConfig';

/**
 * Specialized validator for signal amplitude analysis
 */
export class AmplitudeValidator {
  private amplitudeHistory: number[] = [];
  
  /**
   * Analyze amplitude characteristics for signal validation
   */
  public validateAmplitude(ppgValue: number): { 
    isValid: boolean;
    validationMessage?: string;
  } {
    // Update amplitude history
    this.amplitudeHistory.push(Math.abs(ppgValue));
    if (this.amplitudeHistory.length > ValidationConfig.AMPLITUDE_HISTORY_SIZE) {
      this.amplitudeHistory.shift();
    }
    
    // Only validate when we have enough samples
    if (this.amplitudeHistory.length < 10) {
      return { isValid: true };
    }
    
    const amplitudeStats = this.calculateAmplitudeStats(this.amplitudeHistory);
      
    if (amplitudeStats.max - amplitudeStats.min < ValidationConfig.MIN_AMPLITUDE_VARIATION || 
        amplitudeStats.max < ValidationConfig.MIN_AMPLITUDE_THRESHOLD) {
      return { 
        isValid: false,
        validationMessage: "Insufficient signal amplitude variation" 
      };
    }
    
    return { isValid: true };
  }
  
  /**
   * Calculate amplitude statistics for signal validation
   */
  private calculateAmplitudeStats(values: number[]): { min: number, max: number, avg: number } {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    return { min, max, avg };
  }
  
  /**
   * Get current amplitude history
   */
  public getAmplitudeHistory(): number[] {
    return [...this.amplitudeHistory];
  }
  
  /**
   * Reset amplitude validator state
   */
  public reset(): void {
    this.amplitudeHistory = [];
  }
}
