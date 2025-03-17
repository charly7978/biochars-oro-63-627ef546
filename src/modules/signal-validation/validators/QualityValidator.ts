
import { ValidationConfig } from '../ValidationConfig';

/**
 * Specialized validator for signal quality metrics
 */
export class QualityValidator {
  private signalQualityHistory: number[] = [];
  private lastValidTime: number = 0;
  
  /**
   * Validate signal quality based on quality metrics
   */
  public validateQuality(
    signalQuality?: number
  ): { 
    isValid: boolean;
    validationMessage?: string;
  } {
    // Skip if no quality provided
    if (signalQuality === undefined) {
      return { isValid: true };
    }
    
    // Update quality history
    this.signalQualityHistory.push(signalQuality);
    if (this.signalQualityHistory.length > ValidationConfig.QUALITY_HISTORY_SIZE) {
      this.signalQualityHistory.shift();
    }
    
    // Calculate quality metrics
    const avgQuality = this.signalQualityHistory.length > 0 ? 
      this.signalQualityHistory.reduce((sum, q) => sum + q, 0) / this.signalQualityHistory.length : 0;
    
    const goodQualityRatio = this.signalQualityHistory.length > 5 ?
      this.signalQualityHistory.filter(q => q >= ValidationConfig.MIN_QUALITY_THRESHOLD).length / this.signalQualityHistory.length : 0;
    
    const hasReliableSignal = avgQuality >= ValidationConfig.MIN_QUALITY_THRESHOLD && 
                             goodQualityRatio >= ValidationConfig.MIN_QUALITY_RATIO;
    
    // Strict quality validation
    if (!hasReliableSignal || signalQuality < ValidationConfig.MIN_QUALITY_THRESHOLD) {
      return { 
        isValid: false, 
        validationMessage: "Low quality signal rejected" 
      };
    }
    
    // Check refractory period
    const now = Date.now();
    if (now - this.lastValidTime < ValidationConfig.REFRACTORY_PERIOD_MS) {
      return { 
        isValid: false,
        validationMessage: "In refractory period" 
      };
    }
    
    this.lastValidTime = now;
    return { isValid: true };
  }
  
  /**
   * Get current quality history
   */
  public getQualityHistory(): number[] {
    return [...this.signalQualityHistory];
  }
  
  /**
   * Reset quality validator state
   */
  public reset(): void {
    this.signalQualityHistory = [];
    this.lastValidTime = 0;
  }
}
