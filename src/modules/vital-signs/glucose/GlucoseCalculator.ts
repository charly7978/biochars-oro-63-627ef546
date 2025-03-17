/**
 * GlucoseCalculator
 * Core calculator for glucose estimation from PPG signals
 */
import { GlucoseConfig } from './GlucoseConfig';

export class GlucoseCalculator {
  /**
   * Calculate glucose based on signal metrics
   */
  public static calculateGlucoseEstimate(
    amplitude: number,
    frequency: number,
    phase: number,
    perfusionIndex: number,
    areaUnderCurve: number,
    variability: number,
    individualFactor: number
  ): number {
    // Start with baseline
    let glucoseEstimate = GlucoseConfig.GLUCOSE_BASELINE;
    
    // Apply smaller adjustments to prevent extreme values
    glucoseEstimate += amplitude * GlucoseConfig.AMPLITUDE_FACTOR * 100;
    glucoseEstimate += frequency * GlucoseConfig.FREQUENCY_FACTOR * 150;
    glucoseEstimate += phase * GlucoseConfig.PHASE_FACTOR * 50;
    glucoseEstimate += areaUnderCurve * GlucoseConfig.AREA_UNDER_CURVE_FACTOR * 35;
    
    // Perfusion index contribution
    const perfusionAdjustment = (perfusionIndex - 0.5) * GlucoseConfig.PERFUSION_FACTOR * 40;
    glucoseEstimate += perfusionAdjustment;
    
    // Add small variability component
    glucoseEstimate += (variability - 0.5) * 8;
    
    // Apply individual variation factor based on signal characteristics
    glucoseEstimate = glucoseEstimate * (1 + (individualFactor - 0.5) * 0.15);
    
    // Apply physiological constraints
    glucoseEstimate = Math.max(
      GlucoseConfig.MIN_GLUCOSE, 
      Math.min(GlucoseConfig.MAX_GLUCOSE, glucoseEstimate)
    );
    
    return glucoseEstimate;
  }
  
  /**
   * Calculate individual variation factor based on unique signal characteristics
   */
  public static calculateIndividualFactor(values: number[]): number {
    if (values.length < 30) return 0.5;
    
    // Calculate signal pattern features that vary between individuals
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const deviations = values.map(v => Math.abs(v - avg));
    const meanDeviation = deviations.reduce((sum, val) => sum + val, 0) / deviations.length;
    
    // Calculate periodicity feature
    let crossings = 0;
    for (let i = 1; i < values.length; i++) {
      if ((values[i] > avg && values[i-1] <= avg) || 
          (values[i] <= avg && values[i-1] > avg)) {
        crossings++;
      }
    }
    
    // Normalize crossings to signal length
    const normalizedCrossings = crossings / values.length;
    
    // Create individualization factor from combined metrics
    const factor = (meanDeviation * 3 + normalizedCrossings * 2) / 5;
    
    // Normalize to 0.4-0.6 range (more conservative)
    return Math.min(0.6, Math.max(0.4, 0.4 + factor * 0.2));
  }
  
  /**
   * Stabilize readings over time to prevent fluctuations
   */
  public static stabilizeReading(
    currentReading: number, 
    previousValues: number[],
    lastCalculatedGlucose: number
  ): number {
    // If we don't have enough history, return the current reading
    if (previousValues.length < 2) {
      return currentReading;
    }
    
    // Calculate weighted average with more weight on recent values
    let weightedSum = 0;
    let weightSum = 0;
    
    for (let i = 0; i < previousValues.length; i++) {
      const weight = i + 1; // More recent values get higher weights
      weightedSum += previousValues[i] * weight;
      weightSum += weight;
    }
    
    const stableValue = weightedSum / weightSum;
    
    // Allow more variation if the change is consistent
    const isConsistentChange = previousValues.every(v => 
      (v > lastCalculatedGlucose && currentReading > lastCalculatedGlucose) ||
      (v < lastCalculatedGlucose && currentReading < lastCalculatedGlucose)
    );
    
    // If change is consistent, allow faster changes
    if (isConsistentChange) {
      // Return value closer to current reading
      return stableValue * 0.3 + currentReading * 0.7;
    }
    
    // Otherwise, provide more stable reading
    return stableValue * 0.8 + currentReading * 0.2; // More stability (0.8 weight)
  }
}
