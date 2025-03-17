
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
   * Calculate standard deviation
   */
  public static calculateStandardDeviation(values: number[]): number {
    const n = values.length;
    if (n === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const sqDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / n;
    return Math.sqrt(avgSqDiff);
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
