
/**
 * Channel-specific signal optimizer
 * Provides specialized optimization for each vital sign channel
 */
import { SignalChannel } from '../signal-processing/SignalChannel';
import { OptimizationFeedback, OptimizationOptions } from './types/OptimizationTypes';

export class ChannelOptimizer {
  private readonly channelName: string;
  private options: OptimizationOptions;
  private adaptiveSettings: Map<string, number> = new Map();
  private readonly MAX_HISTORY_VALUES = 10;
  private performanceHistory: number[] = [];
  
  constructor(channelName: string, options: OptimizationOptions) {
    this.channelName = channelName;
    this.options = { ...options };
    this.initializeAdaptiveSettings();
  }
  
  /**
   * Initialize adaptive settings based on channel type
   */
  private initializeAdaptiveSettings(): void {
    // Base settings
    this.adaptiveSettings.set('amplificationFactor', this.options.amplificationFactor || 1.0);
    this.adaptiveSettings.set('noiseReductionLevel', this.options.noiseReductionLevel || 0.8);
    this.adaptiveSettings.set('baselineOffset', 0);
    this.adaptiveSettings.set('frequencyCutoff', 0.5);
    
    // Channel-specific optimizations
    switch (this.channelName) {
      case 'heartRate':
        this.adaptiveSettings.set('peakEnhancement', 1.2);
        this.adaptiveSettings.set('valleyReduction', 0.9);
        break;
        
      case 'spo2':
        this.adaptiveSettings.set('redGreenRatio', 1.1);
        this.adaptiveSettings.set('normalizedPerfusion', 1.0);
        break;
        
      case 'bloodPressure':
        this.adaptiveSettings.set('systolicEnhancement', 1.2);
        this.adaptiveSettings.set('diastolicEnhancement', 1.1);
        this.adaptiveSettings.set('pulseTransitCorrection', 1.0);
        break;
        
      case 'glucose':
        this.adaptiveSettings.set('spectralSensitivity', 1.3);
        this.adaptiveSettings.set('spectralOffset', 0.02);
        break;
        
      case 'lipids':
        this.adaptiveSettings.set('harmonicEnhancement', 1.2);
        this.adaptiveSettings.set('lipidSpectralRatio', 1.0);
        break;
        
      case 'hemoglobin':
        this.adaptiveSettings.set('absorptionRatio', 1.0);
        this.adaptiveSettings.set('oxygenationTrend', 0.5);
        break;
        
      case 'hydration':
        this.adaptiveSettings.set('lowFrequencyGain', 1.2);
        this.adaptiveSettings.set('fluidVolumeMarker', 1.0);
        break;
        
      case 'arrhythmia':
        this.adaptiveSettings.set('irregularityDetection', 1.5);
        this.adaptiveSettings.set('rrVariabilityThreshold', 0.15);
        break;
    }
  }
  
  /**
   * Optimize a signal channel using specialized parameters
   */
  public optimize(channel: SignalChannel): SignalChannel {
    // Get the raw values
    const values = channel.getValues();
    if (values.length === 0) return channel;
    
    // Create a copy of the channel for optimization
    const optimizedValues = [...values];
    
    // Apply specialized optimizations based on channel type
    this.applyChannelSpecificOptimizations(optimizedValues);
    
    // Apply common optimizations
    this.applyCommonOptimizations(optimizedValues);
    
    // Update the channel with optimized values
    this.updateChannelWithOptimizedValues(channel, optimizedValues);
    
    return channel;
  }
  
  /**
   * Apply optimizations specific to each channel type
   */
  private applyChannelSpecificOptimizations(values: number[]): void {
    const amplification = this.adaptiveSettings.get('amplificationFactor') || 1.0;
    
    switch (this.channelName) {
      case 'heartRate':
        this.enhancePeaks(values);
        break;
        
      case 'spo2':
        this.optimizeSpO2Signal(values);
        break;
        
      case 'bloodPressure':
        this.optimizeBloodPressureSignal(values);
        break;
        
      case 'glucose':
        this.optimizeGlucoseSignal(values);
        break;
        
      case 'lipids':
        this.optimizeLipidSignal(values);
        break;
        
      case 'hemoglobin':
        this.optimizeHemoglobinSignal(values);
        break;
        
      case 'hydration':
        this.optimizeHydrationSignal(values);
        break;
        
      case 'arrhythmia':
        this.optimizeArrhythmiaDetection(values);
        break;
    }
    
    // Apply global amplification
    for (let i = 0; i < values.length; i++) {
      values[i] *= amplification;
    }
  }
  
  /**
   * Apply common optimizations to all signals
   */
  private applyCommonOptimizations(values: number[]): void {
    // Apply noise reduction
    const noiseLevel = this.adaptiveSettings.get('noiseReductionLevel') || 0.8;
    this.reduceNoise(values, noiseLevel);
    
    // Apply baseline correction if enabled
    if (this.options.baselineCorrection) {
      this.correctBaseline(values);
    }
  }
  
  /**
   * Update the channel with optimized values
   */
  private updateChannelWithOptimizedValues(channel: SignalChannel, optimizedValues: number[]): void {
    // Get all existing metadata
    const metadata = channel.getAllMetadata();
    
    // Reset the channel
    channel.reset();
    
    // Add the optimized values with original metadata
    const timestamps = Array.from(metadata.keys()).sort();
    
    for (let i = 0; i < optimizedValues.length && i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      const meta = metadata.get(timestamp);
      
      if (meta) {
        // Add enhanced quality metadata
        const enhancedMeta = {
          ...meta,
          quality: Math.min(100, meta.quality * 1.1), // Slightly enhance quality
          optimized: true
        };
        
        channel.addValue(optimizedValues[i], enhancedMeta);
      } else {
        channel.addValue(optimizedValues[i]);
      }
    }
  }
  
  /**
   * Process feedback to improve future optimizations
   */
  public processFeedback(feedback: OptimizationFeedback): void {
    // Track performance
    this.performanceHistory.push(feedback.qualityDelta);
    if (this.performanceHistory.length > this.MAX_HISTORY_VALUES) {
      this.performanceHistory.shift();
    }
    
    // Calculate average performance
    const avgPerformance = this.performanceHistory.reduce((sum, val) => sum + val, 0) / 
                           this.performanceHistory.length;
    
    // Adjust optimization parameters based on feedback
    if (feedback.qualityDelta > 0.7) {
      // Good performance, slightly increase amplification
      this.adaptiveSettings.set(
        'amplificationFactor', 
        Math.min(1.5, (this.adaptiveSettings.get('amplificationFactor') || 1.0) * 1.05)
      );
    } else if (feedback.qualityDelta < 0.3) {
      // Poor performance, increase noise reduction
      this.adaptiveSettings.set(
        'noiseReductionLevel', 
        Math.min(0.99, (this.adaptiveSettings.get('noiseReductionLevel') || 0.8) + 0.05)
      );
    }
    
    // Channel-specific feedback processing
    switch (this.channelName) {
      case 'heartRate':
        if (feedback.qualityDelta < 0.5) {
          this.adaptiveSettings.set('peakEnhancement', Math.min(1.5, (this.adaptiveSettings.get('peakEnhancement') || 1.2) + 0.05));
        }
        break;
        
      case 'spo2':
        if (feedback.qualityDelta < 0.5) {
          this.adaptiveSettings.set('redGreenRatio', Math.min(1.3, (this.adaptiveSettings.get('redGreenRatio') || 1.1) + 0.05));
        }
        break;
        
      case 'glucose':
        if (feedback.qualityDelta < 0.5) {
          this.adaptiveSettings.set('spectralSensitivity', Math.min(1.5, (this.adaptiveSettings.get('spectralSensitivity') || 1.3) + 0.05));
        }
        break;
    }
  }
  
  /**
   * Get optimization statistics
   */
  public getOptimizationStats(): {
    improvementFactor: number;
    stability: number;
    adaptationLevel: number;
  } {
    const avgPerformance = this.performanceHistory.length > 0 ? 
      this.performanceHistory.reduce((sum, val) => sum + val, 0) / this.performanceHistory.length : 0.5;
    
    return {
      improvementFactor: avgPerformance,
      stability: this.calculateStability(),
      adaptationLevel: this.calculateAdaptationLevel()
    };
  }
  
  /**
   * Calculate signal stability based on history
   */
  private calculateStability(): number {
    if (this.performanceHistory.length < 2) return 0.5;
    
    let varianceSum = 0;
    const avg = this.performanceHistory.reduce((sum, val) => sum + val, 0) / this.performanceHistory.length;
    
    for (const perf of this.performanceHistory) {
      varianceSum += Math.pow(perf - avg, 2);
    }
    
    const variance = varianceSum / this.performanceHistory.length;
    // Lower variance means higher stability
    return Math.max(0, Math.min(1, 1 - (variance * 10)));
  }
  
  /**
   * Calculate adaptation level based on changes to adaptive settings
   */
  private calculateAdaptationLevel(): number {
    // Compare current settings to initial settings
    const amplificationDelta = Math.abs((this.adaptiveSettings.get('amplificationFactor') || 1.0) - 
                                        (this.options.amplificationFactor || 1.0));
    const noiseDelta = Math.abs((this.adaptiveSettings.get('noiseReductionLevel') || 0.8) - 
                               (this.options.noiseReductionLevel || 0.8));
    
    // More changes indicate higher adaptation
    return Math.min(1, (amplificationDelta + noiseDelta) * 2);
  }
  
  /**
   * Reset the optimizer to initial settings
   */
  public reset(): void {
    this.initializeAdaptiveSettings();
    this.performanceHistory = [];
  }
  
  // Implementation of optimization algorithms
  
  /**
   * Enhance peaks for better heart rate detection
   */
  private enhancePeaks(values: number[]): void {
    const peakEnhancement = this.adaptiveSettings.get('peakEnhancement') || 1.2;
    const valleyReduction = this.adaptiveSettings.get('valleyReduction') || 0.9;
    
    if (values.length < 5) return;
    
    // Find local maxima and minima
    for (let i = 2; i < values.length - 2; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        // Local maximum - enhance
        values[i] *= peakEnhancement;
      } else if (values[i] < values[i-1] && values[i] < values[i+1]) {
        // Local minimum - reduce
        values[i] *= valleyReduction;
      }
    }
  }
  
  /**
   * Optimize SpO2 signal
   */
  private optimizeSpO2Signal(values: number[]): void {
    const redGreenRatio = this.adaptiveSettings.get('redGreenRatio') || 1.1;
    
    // Enhance AC components relevant to SpO2
    if (values.length < 10) return;
    
    // Calculate moving average for DC component
    const windowSize = Math.min(10, Math.floor(values.length / 3));
    const movingAvg = [];
    
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(values.length - 1, i + windowSize); j++) {
        sum += values[j];
        count++;
      }
      
      movingAvg[i] = sum / count;
    }
    
    // Enhance AC/DC ratio
    for (let i = 0; i < values.length; i++) {
      const dcComponent = movingAvg[i];
      const acComponent = values[i] - dcComponent;
      
      // Enhance AC component
      values[i] = dcComponent + (acComponent * redGreenRatio);
    }
  }
  
  /**
   * Optimize blood pressure signal
   */
  private optimizeBloodPressureSignal(values: number[]): void {
    const systolicEnhancement = this.adaptiveSettings.get('systolicEnhancement') || 1.2;
    
    if (values.length < 15) return;
    
    // Enhance the upslope (systolic phase)
    for (let i = 1; i < values.length; i++) {
      const slope = values[i] - values[i-1];
      
      if (slope > 0) {
        // Upslope - enhance for systolic
        values[i] = values[i-1] + (slope * systolicEnhancement);
      }
    }
  }
  
  /**
   * Optimize glucose signal
   */
  private optimizeGlucoseSignal(values: number[]): void {
    const spectralSensitivity = this.adaptiveSettings.get('spectralSensitivity') || 1.3;
    const spectralOffset = this.adaptiveSettings.get('spectralOffset') || 0.02;
    
    if (values.length < 20) return;
    
    // Apply spectral enhancement for glucose-relevant frequencies
    // Simplified spectral processing
    for (let i = 0; i < values.length; i++) {
      values[i] = (values[i] + spectralOffset) * spectralSensitivity;
    }
  }
  
  /**
   * Optimize lipid signal
   */
  private optimizeLipidSignal(values: number[]): void {
    const harmonicEnhancement = this.adaptiveSettings.get('harmonicEnhancement') || 1.2;
    
    if (values.length < 20) return;
    
    // Apply harmonic enhancement
    for (let i = 2; i < values.length - 2; i++) {
      // Simple harmonic pattern detection and enhancement
      const pattern = values[i-2] - values[i-1] + values[i] - values[i+1] + values[i+2];
      values[i] += (pattern * 0.1 * harmonicEnhancement);
    }
  }
  
  /**
   * Optimize hemoglobin signal
   */
  private optimizeHemoglobinSignal(values: number[]): void {
    const absorptionRatio = this.adaptiveSettings.get('absorptionRatio') || 1.0;
    
    if (values.length < 15) return;
    
    // Apply absorption-based enhancement
    for (let i = 0; i < values.length; i++) {
      // Enhance absorption patterns - simplified
      values[i] = Math.pow(values[i], absorptionRatio);
    }
    
    // Normalize after enhancement
    const maxVal = Math.max(...values);
    if (maxVal > 0) {
      for (let i = 0; i < values.length; i++) {
        values[i] /= maxVal;
      }
    }
  }
  
  /**
   * Optimize hydration signal
   */
  private optimizeHydrationSignal(values: number[]): void {
    const lowFrequencyGain = this.adaptiveSettings.get('lowFrequencyGain') || 1.2;
    
    if (values.length < 20) return;
    
    // Apply low frequency enhancement - simplified
    const windowSize = Math.min(10, Math.floor(values.length / 3));
    const smoothed = [];
    
    // Create smoothed version (low frequencies)
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(values.length - 1, i + windowSize); j++) {
        sum += values[j];
        count++;
      }
      
      smoothed[i] = sum / count;
    }
    
    // Enhance low frequencies
    for (let i = 0; i < values.length; i++) {
      values[i] = (values[i] * 0.3) + (smoothed[i] * 0.7 * lowFrequencyGain);
    }
  }
  
  /**
   * Optimize arrhythmia detection signal
   */
  private optimizeArrhythmiaDetection(values: number[]): void {
    const irregularityDetection = this.adaptiveSettings.get('irregularityDetection') || 1.5;
    
    if (values.length < 15) return;
    
    // Identify irregular patterns
    for (let i = 2; i < values.length - 2; i++) {
      const prevDiff = Math.abs(values[i] - values[i-1]);
      const nextDiff = Math.abs(values[i] - values[i+1]);
      
      // Enhance irregularities for better detection
      if (prevDiff > 0.1 && nextDiff > 0.1 && Math.abs(prevDiff - nextDiff) > 0.05) {
        // This looks like an irregularity - enhance it
        if (values[i] > values[i-1] && values[i] > values[i+1]) {
          values[i] *= irregularityDetection;
        } else if (values[i] < values[i-1] && values[i] < values[i+1]) {
          values[i] /= irregularityDetection;
        }
      }
    }
  }
  
  /**
   * Reduce noise in signal
   */
  private reduceNoise(values: number[], level: number): void {
    if (values.length < 5) return;
    
    // Apply noise reduction using a simple weighted average
    const temp = [...values];
    
    for (let i = 2; i < values.length - 2; i++) {
      // Weighted moving average
      values[i] = (
        temp[i-2] * 0.05 + 
        temp[i-1] * 0.2 + 
        temp[i] * 0.5 + 
        temp[i+1] * 0.2 + 
        temp[i+2] * 0.05
      ) * level + temp[i] * (1 - level);
    }
  }
  
  /**
   * Correct baseline drift
   */
  private correctBaseline(values: number[]): void {
    if (values.length < 10) return;
    
    // Calculate baseline trend
    const windowSize = Math.min(15, Math.floor(values.length / 4));
    const baseline = [];
    
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(values.length - 1, i + windowSize); j++) {
        sum += values[j];
        count++;
      }
      
      baseline[i] = sum / count;
    }
    
    // Remove baseline from signal
    for (let i = 0; i < values.length; i++) {
      values[i] -= (baseline[i] - baseline[0]);
    }
  }
}
