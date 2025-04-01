
import { VitalSignType, ChannelFeedback } from '../../../types/signal';
import { SpecializedChannel } from './SpecializedChannel';

/**
 * Optimized channel for cardiac signal extraction
 * Implements specialized filters for heart rate detection
 */
export class CardiacChannel extends SpecializedChannel {
  private signalBuffer: number[] = [];
  private baselineValue: number = 0;
  private bandpassLowCutoff: number = 0.5;
  private bandpassHighCutoff: number = 4.0;
  private amplificationFactor: number = 1.2;
  private quality: number = 0.5;
  
  /**
   * Create a new cardiac channel processor
   * @param id Unique channel identifier
   */
  constructor(id: string = 'cardiac-channel') {
    super(id, VitalSignType.CARDIAC);
  }

  /**
   * Implementation of the abstract method for processing values
   */
  protected processValueImpl(value: number): number {
    // Apply cardiac-specific bandpass filter (0.5-4Hz for heart rate)
    const bandpassFiltered = this.applyBandpassFilter(value, this.bandpassLowCutoff, this.bandpassHighCutoff);
    
    // Apply cardiac-specific amplification
    const amplified = bandpassFiltered * this.amplificationFactor;
    
    // Apply baseline correction for cardiac signal
    const baselineCorrected = this.correctBaseline(amplified);
    
    // Update quality metrics
    this.updateQualityMetrics(baselineCorrected);
    
    return baselineCorrected;
  }
  
  /**
   * Apply feedback to adjust cardiac channel parameters
   * @param feedback Feedback from vital sign algorithms
   */
  public override applyFeedback(feedback: ChannelFeedback): void {
    super.applyFeedback(feedback);
    
    // Cardiac-specific adaptations
    if (feedback.suggestedAdjustments.frequencyRangeMin !== undefined) {
      this.bandpassLowCutoff = feedback.suggestedAdjustments.frequencyRangeMin;
    }
    
    if (feedback.suggestedAdjustments.frequencyRangeMax !== undefined) {
      this.bandpassHighCutoff = feedback.suggestedAdjustments.frequencyRangeMax;
    }
    
    // Log adaptation
    console.log(`CardiacChannel: Applied feedback with quality ${feedback.signalQuality}`);
  }
  
  /**
   * Apply cardiac-specific bandpass filter
   * Optimized for heart rate frequency range
   */
  private applyBandpassFilter(value: number, lowCutoff: number, highCutoff: number): number {
    // Simple implementation - in a real system this would be a proper filter
    // For now, we'll just simulate the effect
    
    // Add the value to the buffer
    this.signalBuffer.push(value);
    
    // Keep buffer at reasonable size
    if (this.signalBuffer.length > 30) {
      this.signalBuffer.shift();
    }
    
    // Need at least a few samples
    if (this.signalBuffer.length < 3) {
      return value;
    }
    
    // Simple 3-point moving average as a low-pass filter
    const lowPassFiltered = (
      this.signalBuffer[this.signalBuffer.length - 1] +
      this.signalBuffer[this.signalBuffer.length - 2] +
      this.signalBuffer[this.signalBuffer.length - 3]
    ) / 3;
    
    // High-pass component (difference from original)
    const highPassComponent = value - lowPassFiltered;
    
    // Combine for bandpass effect
    return highPassComponent * 0.8 + lowPassFiltered * 0.2;
  }
  
  /**
   * Correct baseline for cardiac signal
   */
  private correctBaseline(value: number): number {
    // Simple baseline correction
    return value - this.baselineValue;
  }
  
  /**
   * Update quality metrics specific to cardiac signal
   */
  private updateQualityMetrics(value: number): void {
    // Calculate signal strength based on recent values
    if (this.signalBuffer.length > 10) {
      const recentValues = this.signalBuffer.slice(-10);
      const min = Math.min(...recentValues);
      const max = Math.max(...recentValues);
      const peakToPeak = max - min;
      
      // Update quality based on peak-to-peak amplitude
      // Cardiac signals should have clear peaks
      if (peakToPeak > 0.4) {
        this.quality = Math.min(1.0, this.quality + 0.1);
      } else if (peakToPeak < 0.1) {
        this.quality = Math.max(0.0, this.quality - 0.1);
      }
    }
  }
}
