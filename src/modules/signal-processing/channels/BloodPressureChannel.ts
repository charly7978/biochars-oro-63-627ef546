
/**
 * Specialized channel for blood pressure signal processing
 * Optimizes the signal specifically for systolic/diastolic measurement
 * Focuses on pulse wave characteristics and transit time features
 */

import { SpecializedChannel, ChannelConfig } from './SpecializedChannel';
import { VitalSignType } from '../../../types/signal';

/**
 * Blood pressure-specific channel
 */
export class BloodPressureChannel extends SpecializedChannel {
  // BP-specific parameters
  private readonly PULSE_WAVE_EMPHASIS = 1.3;   // Emphasis on pulse wave features
  private readonly SYSTOLIC_WEIGHT = 0.6;       // Weight for systolic components
  private readonly DIASTOLIC_WEIGHT = 0.4;      // Weight for diastolic components
  
  // Tracking pulse features
  private pulseRiseTimeBuffer: number[] = [];
  private pulsePeakBuffer: number[] = [];
  private pulseValleyBuffer: number[] = [];
  private readonly FEATURE_BUFFER_SIZE = 10;    // Store features from last 10 pulses
  
  constructor(config: ChannelConfig) {
    super(VitalSignType.BLOOD_PRESSURE, config);
  }
  
  /**
   * Apply blood pressure-specific optimization to the signal
   * - Emphasizes pulse wave velocity components
   * - Enhances systolic and diastolic features
   * - Preserves amplitude and timing relationships
   */
  protected applyChannelSpecificOptimization(value: number): number {
    // Calculate baseline
    const baseline = this.calculateBaseline();
    
    // Detect and record pulse features
    this.detectPulseFeatures(value, baseline);
    
    // Enhance systolic components (rapid upslope of pulse wave)
    const systolicComponent = this.enhanceSystolicComponent(value, baseline);
    
    // Enhance diastolic components (gradual decline and dicrotic notch)
    const diastolicComponent = this.enhanceDiastolicComponent(value, baseline);
    
    // Combine components with weighting
    const combinedValue = baseline + 
                         (systolicComponent * this.SYSTOLIC_WEIGHT) +
                         (diastolicComponent * this.DIASTOLIC_WEIGHT);
    
    // Apply pulse wave emphasis
    return combinedValue * this.PULSE_WAVE_EMPHASIS;
  }
  
  /**
   * Calculate baseline with specific BP optimizations
   */
  private calculateBaseline(): number {
    if (this.recentValues.length < 5) {
      return 0;
    }
    
    // Use a weighted moving average with more weight on valleys
    // for better diastolic pressure correlation
    const values = this.recentValues.slice(-20);
    
    if (values.length < 10) {
      return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    
    // Find potential valleys for better baseline
    const sorted = [...values].sort((a, b) => a - b);
    const lowerQuartile = sorted[Math.floor(sorted.length * 0.25)];
    
    // Weight values near lower quartile more heavily
    let weightedSum = 0;
    let weightSum = 0;
    
    for (const value of values) {
      const weight = Math.exp(-Math.pow((value - lowerQuartile) / (sorted[sorted.length-1] - sorted[0]), 2) * 4);
      weightedSum += value * weight;
      weightSum += weight;
    }
    
    return weightedSum / weightSum;
  }
  
  /**
   * Detect and track features of the pulse wave
   */
  private detectPulseFeatures(value: number, baseline: number): void {
    if (this.recentValues.length < 5) {
      return;
    }
    
    const recentValues = this.recentValues.slice(-5);
    const normalized = recentValues.map(v => v - baseline);
    
    // Check for peak (R-wave of PPG equivalent to systolic peak)
    if (normalized.length >= 3 && 
        normalized[normalized.length-2] > normalized[normalized.length-3] &&
        normalized[normalized.length-2] > normalized[normalized.length-1] &&
        normalized[normalized.length-2] > 0.2) {
      
      // Found a peak
      this.pulsePeakBuffer.push(normalized[normalized.length-2]);
      if (this.pulsePeakBuffer.length > this.FEATURE_BUFFER_SIZE) {
        this.pulsePeakBuffer.shift();
      }
      
      // Calculate rise time (time from last valley to this peak)
      // In real implementation this would use actual time values
      if (this.pulseValleyBuffer.length > 0) {
        this.pulseRiseTimeBuffer.push(1); // Placeholder for demo
        if (this.pulseRiseTimeBuffer.length > this.FEATURE_BUFFER_SIZE) {
          this.pulseRiseTimeBuffer.shift();
        }
      }
    }
    
    // Check for valley (diastolic trough)
    if (normalized.length >= 3 && 
        normalized[normalized.length-2] < normalized[normalized.length-3] &&
        normalized[normalized.length-2] < normalized[normalized.length-1]) {
      
      // Found a valley
      this.pulseValleyBuffer.push(normalized[normalized.length-2]);
      if (this.pulseValleyBuffer.length > this.FEATURE_BUFFER_SIZE) {
        this.pulseValleyBuffer.shift();
      }
    }
  }
  
  /**
   * Enhance systolic components of the signal
   * Emphasizes the rapid upstroke of the pulse wave
   */
  private enhanceSystolicComponent(value: number, baseline: number): number {
    // If not enough data
    if (this.recentValues.length < 5) {
      return value - baseline;
    }
    
    const recentValues = this.recentValues.slice(-5);
    const normalized = recentValues.map(v => v - baseline);
    
    // Calculate slope (first derivative)
    const slopes: number[] = [];
    for (let i = 1; i < normalized.length; i++) {
      slopes.push(normalized[i] - normalized[i-1]);
    }
    
    // Emphasize positive slopes (upstroke of pulse wave)
    const positiveSlope = Math.max(0, slopes[slopes.length-1]);
    
    // Calculate systolic emphasis based on historical peaks
    let peakEmphasis = 1.0;
    if (this.pulsePeakBuffer.length > 0) {
      const avgPeak = this.pulsePeakBuffer.reduce((sum, p) => sum + p, 0) / this.pulsePeakBuffer.length;
      // Higher emphasis as we approach historical peak values
      const normalizedValue = (value - baseline) / avgPeak;
      peakEmphasis = Math.min(1.5, Math.max(0.8, 1 + (normalizedValue - 0.5) * 0.5));
    }
    
    // Apply systolic emphasis
    return (value - baseline) * (1 + positiveSlope * 1.5) * peakEmphasis;
  }
  
  /**
   * Enhance diastolic components of the signal
   * Emphasizes the descending limb and dicrotic notch
   */
  private enhanceDiastolicComponent(value: number, baseline: number): number {
    // If not enough data
    if (this.recentValues.length < 5) {
      return value - baseline;
    }
    
    const recentValues = this.recentValues.slice(-5);
    const normalized = recentValues.map(v => v - baseline);
    
    // Calculate negative slopes (downstroke of pulse wave)
    const slopes: number[] = [];
    for (let i = 1; i < normalized.length; i++) {
      slopes.push(normalized[i] - normalized[i-1]);
    }
    
    const negativeSlope = Math.min(0, slopes[slopes.length-1]);
    
    // Calculate diastolic emphasis based on historical valleys
    let valleyEmphasis = 1.0;
    if (this.pulseValleyBuffer.length > 0) {
      const avgValley = this.pulseValleyBuffer.reduce((sum, v) => sum + v, 0) / this.pulseValleyBuffer.length;
      // Higher emphasis as we approach historical valley values
      const normalizedValue = (value - baseline) / Math.max(0.001, avgValley);
      valleyEmphasis = Math.min(1.5, Math.max(0.8, 1 + (1 - normalizedValue) * 0.4));
    }
    
    // Detect potential dicrotic notch
    // In the real implementation this would use more sophisticated detection
    let dicroticEmphasis = 1.0;
    if (slopes.length >= 3) {
      if (slopes[slopes.length-3] < 0 && 
          slopes[slopes.length-2] < slopes[slopes.length-3] &&
          slopes[slopes.length-1] > slopes[slopes.length-2]) {
        // Pattern resembling a dicrotic notch
        dicroticEmphasis = 1.3;
      }
    }
    
    // Apply diastolic emphasis
    return (value - baseline) * (1 - negativeSlope * 0.8) * valleyEmphasis * dicroticEmphasis;
  }
  
  /**
   * Reset channel state
   */
  public override reset(): void {
    super.reset();
    this.pulseRiseTimeBuffer = [];
    this.pulsePeakBuffer = [];
    this.pulseValleyBuffer = [];
  }
  
  /**
   * Get pulse wave characteristics for BP calculation
   */
  public getPulseWaveCharacteristics(): {
    avgPeakAmplitude: number;
    avgValleyAmplitude: number;
    avgRiseTime: number;
  } {
    return {
      avgPeakAmplitude: this.pulsePeakBuffer.length > 0 
        ? this.pulsePeakBuffer.reduce((sum, p) => sum + p, 0) / this.pulsePeakBuffer.length 
        : 0,
      avgValleyAmplitude: this.pulseValleyBuffer.length > 0
        ? this.pulseValleyBuffer.reduce((sum, v) => sum + v, 0) / this.pulseValleyBuffer.length
        : 0,
      avgRiseTime: this.pulseRiseTimeBuffer.length > 0
        ? this.pulseRiseTimeBuffer.reduce((sum, t) => sum + t, 0) / this.pulseRiseTimeBuffer.length
        : 0
    };
  }
}
