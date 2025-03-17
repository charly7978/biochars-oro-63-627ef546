
/**
 * Utility functions for signal filtering and processing
 */
export class FilterUtils {
  /**
   * Apply Simple Moving Average filter
   */
  public static applySMAFilter(value: number, values: number[], windowSize: number): number {
    const buffer = [...values, value].slice(-windowSize);
    const sum = buffer.reduce((a, b) => a + b, 0);
    return sum / buffer.length;
  }
  
  /**
   * Apply Exponential Moving Average filter
   */
  public static applyEMAFilter(value: number, previousValue: number, alpha: number): number {
    return alpha * value + (1 - alpha) * previousValue;
  }
  
  /**
   * Calculate AC component (peak-to-peak amplitude)
   */
  public static calculateAC(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.max(...values) - Math.min(...values);
  }
  
  /**
   * Calculate DC component (average value)
   */
  public static calculateDC(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  /**
   * Calculate signal variance
   */
  public static calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }
  
  /**
   * Calculate standard deviation
   */
  public static calculateStandardDeviation(values: number[]): number {
    return Math.sqrt(this.calculateVariance(values));
  }
  
  /**
   * Find peaks in signal data
   */
  public static findPeaks(values: number[], threshold: number = 0.3): number[] {
    const peaks: number[] = [];
    
    for (let i = 2; i < values.length - 2; i++) {
      const v = values[i];
      if (
        v > values[i - 1] &&
        v > values[i - 2] &&
        v > values[i + 1] &&
        v > values[i + 2] &&
        v > threshold
      ) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Find both peaks and valleys in signal data
   */
  public static findPeaksAndValleys(values: number[]): { 
    peakIndices: number[];
    valleyIndices: number[];
  } {
    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];

    for (let i = 2; i < values.length - 2; i++) {
      const v = values[i];
      if (
        v > values[i - 1] &&
        v > values[i - 2] &&
        v > values[i + 1] &&
        v > values[i + 2]
      ) {
        peakIndices.push(i);
      }
      if (
        v < values[i - 1] &&
        v < values[i - 2] &&
        v < values[i + 1] &&
        v < values[i + 2]
      ) {
        valleyIndices.push(i);
      }
    }
    
    return { peakIndices, valleyIndices };
  }
}
