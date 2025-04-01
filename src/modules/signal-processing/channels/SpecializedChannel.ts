
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
 * Base class for all specialized signal channels
 */
export abstract class SpecializedChannel implements OptimizedSignalChannel {
  public readonly id: string;
  public readonly type: VitalSignType; // Changed from protected to public to match the interface
  protected config: ChannelConfig;
  protected quality: number = 0;
  protected amplificationFactor: number;
  protected filterStrength: number;
  
  constructor(type: VitalSignType, config: ChannelConfig) {
    this.id = uuidv4();
    this.type = type;
    this.config = config;
    this.amplificationFactor = config.initialAmplification;
    this.filterStrength = config.initialFilterStrength;
  }
  
  /**
   * Process a value for this specific channel
   * @param value Raw signal value
   * @returns Processed value optimized for this vital sign
   */
  public abstract processValue(value: number): number;
  
  /**
   * Apply feedback from algorithm to optimize channel parameters
   * @param feedback Feedback data from vital sign algorithm
   */
  public applyFeedback(feedback: ChannelFeedback): void {
    if (feedback.channelId !== this.id) return;
    
    // Update quality based on feedback
    this.quality = feedback.signalQuality;
    
    // Apply suggested adjustments if provided
    const { suggestedAdjustments } = feedback;
    if (suggestedAdjustments) {
      if (suggestedAdjustments.amplificationFactor !== undefined) {
        this.amplificationFactor = suggestedAdjustments.amplificationFactor;
      }
      
      if (suggestedAdjustments.filterStrength !== undefined) {
        this.filterStrength = suggestedAdjustments.filterStrength;
      }
    }
  }
  
  /**
   * Get current channel quality
   * @returns Quality score between 0-1
   */
  public getQuality(): number {
    return this.quality;
  }
  
  /**
   * Reset channel state
   */
  public reset(): void {
    this.quality = 0;
    this.amplificationFactor = this.config.initialAmplification;
    this.filterStrength = this.config.initialFilterStrength;
  }
  
  /**
   * Apply bandpass filter for this channel's frequency range
   * @param value Input value
   * @returns Filtered value
   */
  protected applyFilter(value: number): number {
    // Simple implementation - in practice would use proper bandpass filter
    return value * (1 - this.filterStrength * 0.5);
  }
  
  /**
   * Apply amplification specific to this channel
   * @param value Input value
   * @returns Amplified value
   */
  protected applyAmplification(value: number): number {
    return value * this.amplificationFactor;
  }
}
