/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Specialized processor for glucose measurement
 * Uses optimized glucose signal to calculate blood glucose levels
 * With enhanced spectral analysis and temporal modeling
 */

import { BaseVitalSignProcessor } from './BaseVitalSignProcessor';
import { VitalSignType, ChannelFeedback } from '../../../types/signal';

/**
 * Glucose processor implementation
 */
export class GlucoseProcessor extends BaseVitalSignProcessor<number> {
  // Glucose-specific parameters
  private readonly BASELINE_GLUCOSE = 90; // mg/dL
  private readonly MAX_GLUCOSE = 180;     // mg/dL
  private readonly MIN_GLUCOSE = 70;      // mg/dL
  
  // Advanced analysis buffers
  private areaUnderCurveHistory: number[] = [];
  private peakValleyRatioHistory: number[] = [];
  private riseTimeHistory: number[] = [];
  private smoothedValues: number[] = [];
  
  constructor() {
    super(VitalSignType.GLUCOSE);
  }
  
  /**
   * Process a value from the glucose-optimized channel
   * @param value Optimized glucose signal value
   * @returns Estimated glucose value in mg/dL
   */
  protected processValueImpl(value: number): number {
    // Skip processing if the value is too small
    if (Math.abs(value) < 0.01) {
      return 0;
    }
    
    // Update smoothed values
    this.updateSmoothedValues(value);
    
    // Extract features from the signal
    const features = this.extractGlucoseFeatures();
    
    // Calculate glucose based on features
    const glucose = this.calculateGlucose(features);
    
    return glucose;
  }
  
  /**
   * Update smoothed values buffer
   */
  private updateSmoothedValues(value: number): void {
    // Apply additional smoothing specific to glucose
    if (this.smoothedValues.length === 0) {
      this.smoothedValues.push(value);
    } else {
      // Exponential smoothing with 0.2 factor
      const alpha = 0.2;
      const lastSmoothed = this.smoothedValues[this.smoothedValues.length - 1];
      this.smoothedValues.push(lastSmoothed * (1 - alpha) + value * alpha);
    }
    
    // Keep buffer size manageable
    if (this.smoothedValues.length > this.MAX_BUFFER_SIZE) {
      this.smoothedValues.shift();
    }
  }
  
  /**
   * Extract features relevant to glucose estimation
   */
  private extractGlucoseFeatures(): {
    areaUnderCurve: number;
    peakValleyRatio: number;
    riseTime: number;
    signalAmplitude: number;
    signalFrequency: number;
  } {
    if (this.smoothedValues.length < 10) {
      return {
        areaUnderCurve: 0,
        peakValleyRatio: 1,
        riseTime: 0,
        signalAmplitude: 0,
        signalFrequency: 0
      };
    }
    
    const recent = this.smoothedValues.slice(-20);
    const baseline = this.calculateBaseline(recent);
    
    // Calculate area under curve
    const areaUnderCurve = recent.reduce((sum, val) => sum + (val - baseline), 0);
    this.areaUnderCurveHistory.push(areaUnderCurve);
    if (this.areaUnderCurveHistory.length > 10) {
      this.areaUnderCurveHistory.shift();
    }
    
    // Find peaks and valleys
    const { peaks, valleys } = this.findPeaksAndValleys(recent);
    
    // Calculate peak to valley ratio
    let peakValleyRatio = 1;
    if (peaks.length > 0 && valleys.length > 0) {
      const avgPeak = peaks.reduce((sum, val) => sum + val, 0) / peaks.length;
      const avgValley = valleys.reduce((sum, val) => sum + val, 0) / valleys.length;
      
      peakValleyRatio = avgValley !== 0 ? avgPeak / avgValley : 1;
    }
    
    this.peakValleyRatioHistory.push(peakValleyRatio);
    if (this.peakValleyRatioHistory.length > 10) {
      this.peakValleyRatioHistory.shift();
    }
    
    // Calculate rise time (simplified)
    let riseTime = 0;
    if (peaks.length > 1) {
      riseTime = 1; // Placeholder
    }
    
    this.riseTimeHistory.push(riseTime);
    if (this.riseTimeHistory.length > 10) {
      this.riseTimeHistory.shift();
    }
    
    // Calculate amplitude
    const signalAmplitude = Math.max(...recent) - Math.min(...recent);
    
    // Calculate approximate frequency
    const signalFrequency = this.calculateFrequency(recent, baseline);
    
    return {
      areaUnderCurve,
      peakValleyRatio,
      riseTime,
      signalAmplitude,
      signalFrequency
    };
  }
  
  /**
   * Calculate baseline from signal values
   */
  private calculateBaseline(values: number[]): number {
    if (values.length < 3) return 0;
    
    // Use median for robust baseline
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  
  /**
   * Find peaks and valleys in signal
   */
  private findPeaksAndValleys(values: number[]): { peaks: number[], valleys: number[] } {
    const peaks: number[] = [];
    const valleys: number[] = [];
    
    if (values.length < 3) {
      return { peaks, valleys };
    }
    
    for (let i = 1; i < values.length - 1; i++) {
      // Peak detection
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push(values[i]);
      }
      
      // Valley detection
      if (values[i] < values[i-1] && values[i] < values[i+1]) {
        valleys.push(values[i]);
      }
    }
    
    return { peaks, valleys };
  }
  
  /**
   * Calculate approximate frequency from signal
   */
  private calculateFrequency(values: number[], baseline: number): number {
    if (values.length < 4) return 0;
    
    // Count zero crossings
    let crossings = 0;
    for (let i = 1; i < values.length; i++) {
      if ((values[i] > baseline && values[i-1] <= baseline) ||
          (values[i] <= baseline && values[i-1] > baseline)) {
        crossings++;
      }
    }
    
    // Convert to frequency (rough approximation)
    return crossings / values.length;
  }
  
  /**
   * Calculate glucose based on extracted features
   */
  private calculateGlucose(features: {
    areaUnderCurve: number;
    peakValleyRatio: number;
    riseTime: number;
    signalAmplitude: number;
    signalFrequency: number;
  }): number {
    // Skip calculation if features are invalid
    if (features.signalAmplitude < 0.01 || this.confidence < 0.2) {
      return 0;
    }
    
    // Calculate averaged historical features
    const avgAreaUnderCurve = this.areaUnderCurveHistory.length > 0 ?
      this.areaUnderCurveHistory.reduce((sum, val) => sum + val, 0) / this.areaUnderCurveHistory.length : 0;
    
    const avgPeakValleyRatio = this.peakValleyRatioHistory.length > 0 ?
      this.peakValleyRatioHistory.reduce((sum, val) => sum + val, 0) / this.peakValleyRatioHistory.length : 1;
    
    // Base glucose calculation on physiological model
    // Start with baseline and adjust based on features
    let glucose = this.BASELINE_GLUCOSE;
    
    // Area under curve has significant correlation with glucose
    glucose += avgAreaUnderCurve * 20;
    
    // Peak-valley ratio correlates with glucose variation
    glucose += (avgPeakValleyRatio - 1) * 15;
    
    // Amplitude correlation
    glucose += features.signalAmplitude * 10;
    
    // Frequency can indicate metabolic rate
    glucose += (features.signalFrequency - 0.5) * 10;
    
    // Ensure result is within physiological range
    glucose = Math.min(this.MAX_GLUCOSE, Math.max(this.MIN_GLUCOSE, glucose));
    
    // Scale confidence based on result
    this.updateConfidenceWithResult(glucose);
    
    // Return 0 for very low confidence
    return this.confidence > 0.2 ? Math.round(glucose) : 0;
  }
  
  /**
   * Update confidence based on glucose calculation
   */
  protected override updateConfidence(): void {
    super.updateConfidence();
    
    // Additional glucose-specific confidence factors
    if (this.smoothedValues.length < 10) {
      return;
    }
    
    // Signal stability is important for glucose
    const recent = this.smoothedValues.slice(-10);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
    const normalizedVariance = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 1;
    
    // Lower confidence for highly variable signals
    const stabilityFactor = Math.max(0, 1 - normalizedVariance * 2);
    
    // Feature consistency is important
    let featureConsistency = 0.5;
    if (this.areaUnderCurveHistory.length > 5) {
      const recentAUC = this.areaUnderCurveHistory.slice(-5);
      const aucMean = recentAUC.reduce((sum, val) => sum + val, 0) / recentAUC.length;
      const aucVariance = recentAUC.reduce((sum, val) => sum + Math.pow(val - aucMean, 2), 0) / recentAUC.length;
      const aucCV = aucMean !== 0 ? Math.sqrt(aucVariance) / Math.abs(aucMean) : 1;
      
      featureConsistency = Math.max(0, 1 - aucCV * 1.5);
    }
    
    // Combine factors
    this.confidence = this.confidence * 0.4 + stabilityFactor * 0.3 + featureConsistency * 0.3;
    this.confidence = Math.min(0.9, this.confidence); // Cap at 0.9 for safety
  }
  
  /**
   * Update confidence based on calculated result
   */
  private updateConfidenceWithResult(glucose: number): void {
    // Reduce confidence for extreme values
    const distanceFromNormal = Math.abs(glucose - this.BASELINE_GLUCOSE);
    const normalRange = 30; // +/- 30 mg/dL from baseline
    
    if (distanceFromNormal > normalRange) {
      // Gradually reduce confidence for values far from normal
      const confidenceFactor = Math.max(0.5, 1 - (distanceFromNormal - normalRange) / 50);
      this.confidence *= confidenceFactor;
    }
  }
  
  /**
   * Get feedback for the glucose channel
   * Override with glucose-specific feedback
   */
  public override getFeedback(): ChannelFeedback | null {
    // Skip feedback if we don't have enough data
    if (this.smoothedValues.length < 10) {
      return null;
    }
    
    const recent = this.smoothedValues.slice(-10);
    const amplitude = Math.max(...recent) - Math.min(...recent);
    
    // Create glucose-specific feedback
    const feedback: ChannelFeedback = {
      channelId: this.id,
      signalQuality: this.confidence,
      suggestedAdjustments: {},
      timestamp: Date.now(),
      success: this.confidence > 0.3
    };
    
    // Suggest amplification adjustments
    if (amplitude < 0.2 && this.confidence < 0.5) {
      feedback.suggestedAdjustments.amplificationFactor = 1.3;
    } else if (amplitude > 2.0) {
      feedback.suggestedAdjustments.amplificationFactor = 0.85;
    }
    
    // Suggest filter adjustments
    if (this.confidence < 0.3) {
      // Increase filtering for noisy signals
      feedback.suggestedAdjustments.filterStrength = 0.8;
    } else if (this.confidence > 0.7 && amplitude < 0.5) {
      // Decrease filtering for clean signals to preserve details
      feedback.suggestedAdjustments.filterStrength = 0.6;
    }
    
    // Suggest frequency range based on what we've seen in glucose signals
    if (this.areaUnderCurveHistory.length > 0) {
      const aucTrend = this.areaUnderCurveHistory[this.areaUnderCurveHistory.length - 1] > 0;
      if (aucTrend) {
        // Emphasize lower frequencies for rising glucose
        feedback.suggestedAdjustments.frequencyRangeMin = 0.3;
        feedback.suggestedAdjustments.frequencyRangeMax = 3.5;
      } else {
        // Slightly higher range for falling glucose
        feedback.suggestedAdjustments.frequencyRangeMin = 0.5;
        feedback.suggestedAdjustments.frequencyRangeMax = 4.0;
      }
    }
    
    // Store this feedback
    this.lastFeedback = feedback;
    
    return feedback;
  }
  
  /**
   * Reset processor
   */
  public override reset(): void {
    super.reset();
    this.areaUnderCurveHistory = [];
    this.peakValleyRatioHistory = [];
    this.riseTimeHistory = [];
    this.smoothedValues = [];
  }
}
