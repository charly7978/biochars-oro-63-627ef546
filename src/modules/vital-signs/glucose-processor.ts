
/**
 * Glucose processor for estimating glucose from PPG signal
 */
export class GlucoseProcessor {
  private glucoseBuffer: number[] = [];
  private readonly GLUCOSE_BUFFER_SIZE = 10;
  private confidence: number = 0;

  /**
   * Calculate glucose from PPG signal
   */
  public calculateGlucose(values: number[]): number {
    if (values.length < 60) {
      this.confidence = 0;
      return 0;
    }

    // Calculate basic signal metrics
    const signalMean = values.reduce((a, b) => a + b, 0) / values.length;
    const signalVariance = values.reduce((acc, val) => acc + Math.pow(val - signalMean, 2), 0) / values.length;
    const signalMax = Math.max(...values);
    const signalMin = Math.min(...values);
    const signalRange = signalMax - signalMin;

    // Apply a simple PPG-to-glucose model (this is a simplified approximation)
    const baseGlucose = 85; // baseline value in mg/dL
    const glucoseVariation = (signalVariance / Math.pow(signalRange, 2)) * 50;
    const glucoseEstimate = baseGlucose + glucoseVariation;
    
    // Apply physiological constraints
    const constrainedGlucose = Math.max(70, Math.min(180, glucoseEstimate));
    
    // Update confidence based on signal quality
    this.confidence = Math.min(0.8, Math.max(0.1, signalRange / 4));
    
    // Add to buffer for smoothing
    this.glucoseBuffer.push(constrainedGlucose);
    if (this.glucoseBuffer.length > this.GLUCOSE_BUFFER_SIZE) {
      this.glucoseBuffer.shift();
    }
    
    // Calculate smoothed value
    const smoothedGlucose = this.glucoseBuffer.reduce((a, b) => a + b, 0) / this.glucoseBuffer.length;
    
    return Math.round(smoothedGlucose);
  }

  /**
   * Get confidence level of glucose estimate
   */
  public getConfidence(): number {
    return this.confidence;
  }

  /**
   * Reset the processor
   */
  public reset(): void {
    this.glucoseBuffer = [];
    this.confidence = 0;
  }
}
