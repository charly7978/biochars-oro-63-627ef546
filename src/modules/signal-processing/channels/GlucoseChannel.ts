
/**
 * Specialized channel for glucose signal processing
 * Optimizes the signal specifically for glucose measurement algorithms
 */

import { SpecializedChannel, ChannelConfig } from './SpecializedChannel';
import { VitalSignType } from '../../../types/signal';

/**
 * Glucose-specific channel configuration
 */
export class GlucoseChannel extends SpecializedChannel {
  // Glucose-specific parameters
  private readonly LOW_FREQUENCY_WEIGHT = 0.6;  // Higher weight for low frequencies
  private readonly HIGH_FREQUENCY_WEIGHT = 0.4; // Lower weight for high frequencies
  private readonly PERFUSION_EMPHASIS = 1.2;    // Emphasis on perfusion-related components
  private areaUnderCurveBuffer: number[] = [];
  private readonly AUC_BUFFER_SIZE = 30;
  
  constructor(config: ChannelConfig) {
    super(VitalSignType.GLUCOSE, config);
  }
  
  /**
   * Apply glucose-specific optimization to the signal
   * - Emphasizes low-frequency components related to blood glucose changes
   * - Enhances perfusion-related signal characteristics
   * - Calculates and uses area under the curve for glucose correlation
   */
  protected applyChannelSpecificOptimization(value: number): number {
    // Calculate a baseline from recent values
    const baseline = this.calculateBaseline();
    
    // Calculate an emphasis factor based on recent signal areas
    const emphasisFactor = this.calculateEmphasisFactor(value, baseline);
    
    // Apply frequency weighting specific to glucose signal components
    const frequencyWeightedValue = this.applyFrequencyWeighting(value, baseline);
    
    // Enhance perfusion-related components
    const enhancedValue = frequencyWeightedValue * this.PERFUSION_EMPHASIS * emphasisFactor;
    
    // Update area under curve buffer
    this.updateAreaUnderCurveBuffer(value, baseline);
    
    return enhancedValue;
  }
  
  /**
   * Calculate a baseline from recent values
   */
  private calculateBaseline(): number {
    if (this.recentValues.length < 5) {
      return 0;
    }
    
    // Use median filtering for more stable baseline
    const sortedValues = [...this.recentValues].sort((a, b) => a - b);
    return sortedValues[Math.floor(sortedValues.length / 2)];
  }
  
  /**
   * Calculate emphasis factor based on signal characteristics
   */
  private calculateEmphasisFactor(value: number, baseline: number): number {
    // Default emphasis if not enough data
    if (this.recentValues.length < 10) {
      return 1.0;
    }
    
    // Calculate signal area properties
    const areaValues = this.recentValues.map(v => v - baseline);
    let positiveArea = 0;
    let negativeArea = 0;
    
    for (const areaValue of areaValues) {
      if (areaValue > 0) {
        positiveArea += areaValue;
      } else {
        negativeArea += Math.abs(areaValue);
      }
    }
    
    // Area ratio affects emphasis
    const areaRatio = (positiveArea + 0.0001) / (negativeArea + 0.0001);
    
    // Emphasis is higher when areas are more balanced
    const balanceFactor = Math.min(1, 1 / Math.abs(Math.log10(areaRatio)));
    
    return 0.8 + (balanceFactor * 0.4); // Range: 0.8 - 1.2
  }
  
  /**
   * Apply frequency weighting to emphasize glucose-relevant components
   */
  private applyFrequencyWeighting(value: number, baseline: number): number {
    if (this.recentValues.length < 10) {
      return value;
    }
    
    // Split into low and high frequency components
    const lowFreqComponent = this.calculateLowFrequencyComponent(value, baseline);
    const highFreqComponent = value - baseline - lowFreqComponent;
    
    // Weight and combine components
    return baseline + 
           (lowFreqComponent * this.LOW_FREQUENCY_WEIGHT) + 
           (highFreqComponent * this.HIGH_FREQUENCY_WEIGHT);
  }
  
  /**
   * Calculate low frequency component using a simple approximation
   */
  private calculateLowFrequencyComponent(value: number, baseline: number): number {
    if (this.recentValues.length < 8) {
      return value - baseline;
    }
    
    // Simple low-pass filter approximation
    const recent = this.recentValues.slice(-8);
    const avgValue = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    
    return avgValue - baseline;
  }
  
  /**
   * Update area under curve buffer for glucose correlations
   */
  private updateAreaUnderCurveBuffer(value: number, baseline: number): void {
    this.areaUnderCurveBuffer.push(value - baseline);
    
    if (this.areaUnderCurveBuffer.length > this.AUC_BUFFER_SIZE) {
      this.areaUnderCurveBuffer.shift();
    }
  }
  
  /**
   * Get area under curve for recent values
   * Important for glucose correlation
   */
  public getAreaUnderCurve(): number {
    return this.areaUnderCurveBuffer.reduce((sum, val) => sum + val, 0);
  }
  
  /**
   * Reset channel state
   */
  public override reset(): void {
    super.reset();
    this.areaUnderCurveBuffer = [];
  }
}
