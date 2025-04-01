
/**
 * Base class for all specialized channels
 * Provides common functionality and structure for channel-specific optimizations
 */

import { OptimizedSignalChannel, ChannelFeedback, VitalSignType } from '../../../types/signal';
import { v4 as uuidv4 } from 'uuid';

/**
 * Configuration options for specialized channels
 */
export interface ChannelConfig {
  initialAmplification: number;
  initialFilterStrength: number;
  frequencyBandMin: number;
  frequencyBandMax: number;
}

/**
 * Base class for specialized signal channels
 * Each specialized channel optimizes the signal for a specific vital sign
 */
export abstract class SpecializedChannel implements OptimizedSignalChannel {
  public readonly id: string;
  protected readonly type: VitalSignType;
  protected amplificationFactor: number;
  protected filterStrength: number;
  protected frequencyBandMin: number;
  protected frequencyBandMax: number;
  protected quality: number = 0;
  protected recentValues: number[] = [];
  protected readonly MAX_RECENT_VALUES = 100;
  protected lastFeedback: ChannelFeedback | null = null;
  protected feedbackHistory: ChannelFeedback[] = [];
  protected readonly MAX_FEEDBACK_HISTORY = 20;
  
  /**
   * Constructor
   * @param type Type of vital sign this channel processes
   * @param config Configuration options
   */
  constructor(type: VitalSignType, config: ChannelConfig) {
    this.id = `${type}-${uuidv4().substring(0, 8)}`;
    this.type = type;
    this.amplificationFactor = config.initialAmplification;
    this.filterStrength = config.initialFilterStrength;
    this.frequencyBandMin = config.frequencyBandMin;
    this.frequencyBandMax = config.frequencyBandMax;
    
    console.log(`${this.typeToString()} Channel initialized with ID: ${this.id}`);
  }
  
  /**
   * Process a value for this specific channel
   * @param value Raw value to process
   * @returns Processed value
   */
  public processValue(value: number): number {
    // Apply common processing first
    const filteredValue = this.applyFilter(value);
    const amplifiedValue = this.applyAmplification(filteredValue);
    const optimizedValue = this.applyChannelSpecificOptimization(amplifiedValue);
    
    // Add to recent values
    this.recentValues.push(optimizedValue);
    if (this.recentValues.length > this.MAX_RECENT_VALUES) {
      this.recentValues.shift();
    }
    
    // Update quality indicator
    this.updateQuality();
    
    return optimizedValue;
  }
  
  /**
   * Apply channel-specific optimization
   * Must be implemented by each specialized channel
   */
  protected abstract applyChannelSpecificOptimization(value: number): number;
  
  /**
   * Apply filtering to the value
   * @param value Value to filter
   * @returns Filtered value
   */
  protected applyFilter(value: number): number {
    // Base implementation uses exponential moving average
    if (this.recentValues.length === 0) {
      return value;
    }
    
    const lastValue = this.recentValues[this.recentValues.length - 1];
    return lastValue * (1 - this.filterStrength) + value * this.filterStrength;
  }
  
  /**
   * Apply amplification to the value
   * @param value Value to amplify
   * @returns Amplified value
   */
  protected applyAmplification(value: number): number {
    return value * this.amplificationFactor;
  }
  
  /**
   * Apply feedback from algorithm to adjust channel parameters
   * @param feedback Feedback information
   */
  public applyFeedback(feedback: ChannelFeedback): void {
    // Store feedback
    this.lastFeedback = feedback;
    this.feedbackHistory.push(feedback);
    if (this.feedbackHistory.length > this.MAX_FEEDBACK_HISTORY) {
      this.feedbackHistory.shift();
    }
    
    // Apply suggested adjustments
    if (feedback.suggestedAdjustments) {
      const adjustments = feedback.suggestedAdjustments;
      
      // Update amplification if suggested
      if (adjustments.amplificationFactor !== undefined) {
        // Cap adjustment to +/- 10%
        const maxChange = 0.1;
        const currentValue = this.amplificationFactor;
        const targetValue = adjustments.amplificationFactor;
        const change = Math.min(Math.abs(targetValue - currentValue), currentValue * maxChange);
        this.amplificationFactor = currentValue + (targetValue > currentValue ? change : -change);
      }
      
      // Update filter strength if suggested
      if (adjustments.filterStrength !== undefined) {
        // Ensure filter strength stays between 0.1 and 0.95
        this.filterStrength = Math.min(0.95, Math.max(0.1, adjustments.filterStrength));
      }
      
      // Update frequency band if suggested
      if (adjustments.frequencyRangeMin !== undefined) {
        this.frequencyBandMin = adjustments.frequencyRangeMin;
      }
      
      if (adjustments.frequencyRangeMax !== undefined) {
        this.frequencyBandMax = adjustments.frequencyRangeMax;
      }
    }
    
    // Check for consistent feedback patterns
    this.analyzeAndOptimizeFeedbackPatterns();
    
    console.log(`${this.typeToString()} Channel: Applied feedback`, {
      channelId: this.id,
      newAmplification: this.amplificationFactor,
      newFilterStrength: this.filterStrength,
      signalQuality: feedback.signalQuality
    });
  }
  
  /**
   * Analyze feedback history to identify patterns
   * and make autonomous optimizations
   */
  private analyzeAndOptimizeFeedbackPatterns(): void {
    // Need enough feedback for pattern analysis
    if (this.feedbackHistory.length < 5) {
      return;
    }
    
    // Count successful vs unsuccessful operations
    const successCount = this.feedbackHistory.filter(f => f.success).length;
    const failureCount = this.feedbackHistory.length - successCount;
    const successRate = successCount / this.feedbackHistory.length;
    
    // If consistently unsuccessful, make larger adjustments
    if (successRate < 0.3) {
      // Increase adaptability when consistently failing
      console.log(`${this.typeToString()} Channel: Low success rate, making larger adaptations`);
      
      // Average signal quality from feedback
      const avgQuality = this.feedbackHistory.reduce((sum, fb) => sum + fb.signalQuality, 0) / 
                        this.feedbackHistory.length;
      
      // If quality is consistently low, increase amplification
      if (avgQuality < 0.4) {
        this.amplificationFactor *= 1.15; // Increase by 15%
      }
    }
    
    // If consistently successful, make smaller refinements
    if (successRate > 0.8) {
      // Fine-tune for stability
      console.log(`${this.typeToString()} Channel: High success rate, fine-tuning`);
      
      // Slightly reduce filter strength for faster response if it's high
      if (this.filterStrength > 0.8) {
        this.filterStrength *= 0.95;
      }
    }
  }
  
  /**
   * Update internal quality metric
   */
  protected updateQuality(): void {
    if (this.recentValues.length < 5) {
      this.quality = 0;
      return;
    }
    
    // Calculate signal stability
    const recent = this.recentValues.slice(-10);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    
    // Calculate variance
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
    
    // Calculate signal-to-noise ratio (simple approximation)
    const maxDiff = Math.max(...recent) - Math.min(...recent);
    const snr = maxDiff > 0 ? mean / Math.sqrt(variance) : 0;
    
    // Quality is a function of SNR and variance
    // Higher SNR and lower variance (relative to signal) = better quality
    const normalizedVariance = variance / (Math.abs(mean) + 0.0001);
    const varianceQuality = Math.max(0, 1 - Math.min(1, normalizedVariance * 10));
    const snrQuality = Math.min(1, snr / 10);
    
    // Weighted average of quality indicators
    this.quality = (varianceQuality * 0.6 + snrQuality * 0.4);
    
    // Apply feedback influence
    if (this.lastFeedback) {
      // Blend our calculated quality with the algorithm feedback
      const feedbackAge = Date.now() - this.lastFeedback.timestamp;
      const feedbackWeight = Math.max(0, 1 - (feedbackAge / 10000)); // Decay over 10 seconds
      
      this.quality = this.quality * (1 - feedbackWeight * 0.5) + 
                    this.lastFeedback.signalQuality * feedbackWeight * 0.5;
    }
  }
  
  /**
   * Get current quality of this channel (0-1)
   */
  public getQuality(): number {
    return this.quality;
  }
  
  /**
   * Reset channel state
   */
  public reset(): void {
    this.recentValues = [];
    this.quality = 0;
    this.lastFeedback = null;
    this.feedbackHistory = [];
    console.log(`${this.typeToString()} Channel reset`);
  }
  
  /**
   * Convert type to readable string
   */
  protected typeToString(): string {
    return this.type.charAt(0).toUpperCase() + this.type.slice(1);
  }
}
