
/**
 * GlucoseConfidenceCalculator
 * Calculates confidence scores for glucose measurements
 */
export class GlucoseConfidenceCalculator {
  /**
   * Calculate confidence based on signal quality
   */
  public static calculateConfidence(
    values: number[], 
    perfusionIndex: number, 
    variability: number,
    hasQualityData: boolean,
    minSamples: number,
    signalWindowSize: number
  ): number {
    // If not enough data, low confidence
    if (values.length < minSamples || !hasQualityData) {
      return 0;
    }
    
    // Calculate signal stability using windowed approach
    const windowedValues = [];
    for (let i = 0; i < values.length - signalWindowSize; i += signalWindowSize) {
      const windowSlice = values.slice(i, i + signalWindowSize);
      const windowAvg = windowSlice.reduce((sum, val) => sum + val, 0) / windowSlice.length;
      windowedValues.push(windowAvg);
    }
    
    // Calculate variability
    let stabilityVariability = 0;
    if (windowedValues.length > 1) {
      for (let i = 1; i < windowedValues.length; i++) {
        stabilityVariability += Math.abs(windowedValues[i] - windowedValues[i - 1]);
      }
      stabilityVariability /= (windowedValues.length - 1);
    }
    
    // Normalize variability (lower is better)
    const normalizedStability = Math.min(1, Math.max(0, 1 - stabilityVariability / 0.4));
    
    // Perfusion index component (higher is better)
    const perfusionComponent = Math.min(1, perfusionIndex * 6);
    
    // Data quantity component
    const dataComponent = Math.min(1, values.length / (minSamples * 2));
    
    // Signal variability component (lower variability gives higher confidence)
    const variabilityComponent = Math.min(1, Math.max(0, 1 - variability));
    
    // Combined confidence with weighted components
    const confidence = 0.35 * normalizedStability + 
                       0.35 * perfusionComponent + 
                       0.15 * dataComponent +
                       0.15 * variabilityComponent;
    
    return Math.min(0.95, Math.max(0, confidence)); // Cap at 0.95 for honesty
  }
}
