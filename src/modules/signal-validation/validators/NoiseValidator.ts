
import { ValidationConfig } from '../ValidationConfig';

/**
 * Specialized validator for signal noise analysis
 */
export class NoiseValidator {
  private noiseBuffer: number[] = [];
  
  /**
   * Analyze noise characteristics for signal validation
   */
  public validateNoise(ppgValue: number): { 
    isValid: boolean;
    validationMessage?: string;
  } {
    // Update noise buffer
    this.noiseBuffer.push(ppgValue);
    if (this.noiseBuffer.length > ValidationConfig.NOISE_BUFFER_SIZE) {
      this.noiseBuffer.shift();
    }
    
    // Only validate when we have enough samples
    if (this.noiseBuffer.length < 10) {
      return { isValid: true };
    }
    
    const noiseLevel = this.calculateNoiseLevel(this.noiseBuffer);
    if (noiseLevel > ValidationConfig.MAX_NOISE_RATIO) {
      return { 
        isValid: false,
        validationMessage: "Excessive noise detected" 
      };
    }
    
    return { isValid: true };
  }
  
  /**
   * Calculate noise level as ratio between standard deviation and mean
   */
  private calculateNoiseLevel(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Noise-to-signal ratio
    return stdDev / (mean + 0.001); // Avoid division by zero
  }
  
  /**
   * Get current noise buffer
   */
  public getNoiseBuffer(): number[] {
    return [...this.noiseBuffer];
  }
  
  /**
   * Reset noise validator state
   */
  public reset(): void {
    this.noiseBuffer = [];
  }
}
