
/**
 * Enhanced Adaptive Optimizer
 * Dynamically adjusts processing parameters based on signal quality feedback
 */

export interface AdaptiveOptimizerConfig {
  learningRate: number;
  adaptationWindow: number;
  thresholds: {
    signalQuality: number;
    signalAmplitude: number;
    signalStability: number;
    [key: string]: number;
  };
}

export interface OptimizationParameters {
  signalQuality: number;
  signalAmplitude: number;
  signalStability: number;
  [key: string]: number;
}

export interface OptimizedChannel {
  values: number[];
  quality: number;
  metadata: {
    dominantFrequency: number;
    periodicityScore: number;
    [key: string]: any;
  };
}

export class AdaptiveOptimizer {
  private config: AdaptiveOptimizerConfig;
  private history: OptimizationParameters[] = [];
  private optimizedParameters: {[key: string]: number} = {};
  private optimizedWeights: {[key: string]: number} = {};
  private channels: Map<string, OptimizedChannel> = new Map();
  private signalQuality: number = 0;
  
  constructor(config: Partial<AdaptiveOptimizerConfig> | any) {
    // Default config values
    this.config = {
      learningRate: 0.15,
      adaptationWindow: 20,
      thresholds: {
        signalQuality: 0.5,
        signalAmplitude: 0.1,
        signalStability: 0.3
      },
      ...config
    };
    
    // Initialize optimized parameters
    this.optimizedParameters = {
      filterStrength: 0.5,
      amplificationFactor: 1.0,
      noiseReductionLevel: 0.5,
      detectionThreshold: 0.25,
      weightDecay: 0.01
    };
    
    // Initialize optimized weights for quality assessment
    this.optimizedWeights = {
      signalQuality: 0.4,
      signalAmplitude: 0.3,
      signalStability: 0.3
    };

    // Initialize channels
    this.channels.set('heartRate', {
      values: [],
      quality: 0,
      metadata: {
        dominantFrequency: 0,
        periodicityScore: 0
      }
    });

    this.channels.set('spo2', {
      values: [],
      quality: 0,
      metadata: {
        dominantFrequency: 0,
        periodicityScore: 0
      }
    });
  }
  
  /**
   * Process a value through the optimizer
   */
  public processValue(value: number): Map<string, OptimizedChannel> {
    // Update all channels with the new value
    for (const [channelName, channel] of this.channels.entries()) {
      channel.values.push(value);
      
      // Limit channel buffer size
      if (channel.values.length > this.config.adaptationWindow * 2) {
        channel.values.shift();
      }
      
      // Update channel quality
      channel.quality = this.calculateChannelQuality(channel.values, channelName);
      
      // Calculate dominant frequency for heart rate channel
      if (channelName === 'heartRate' && channel.values.length > 20) {
        channel.metadata.dominantFrequency = this.calculateDominantFrequency(channel.values);
        channel.metadata.periodicityScore = this.calculatePeriodicityScore(channel.values);
      }
    }
    
    // Update signal quality
    this.updateSignalQuality();
    
    return this.channels;
  }
  
  /**
   * Calculate dominant frequency using simple peak analysis
   */
  private calculateDominantFrequency(values: number[]): number {
    if (values.length < 20) return 0;
    
    const peaks = this.findPeaks(values);
    if (peaks.length < 2) return 0;
    
    // Calculate average time between peaks (in samples)
    let totalInterval = 0;
    for (let i = 1; i < peaks.length; i++) {
      totalInterval += peaks[i] - peaks[i-1];
    }
    
    const avgInterval = totalInterval / (peaks.length - 1);
    
    // Convert to frequency (assuming 30Hz sample rate)
    return avgInterval > 0 ? 30 / avgInterval : 0;
  }
  
  /**
   * Find peaks in signal
   */
  private findPeaks(values: number[]): number[] {
    const peaks: number[] = [];
    
    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] > values[i-1] && values[i] > values[i+1]) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  /**
   * Calculate periodicity score (0-1)
   */
  private calculatePeriodicityScore(values: number[]): number {
    if (values.length < 20) return 0;
    
    const peaks = this.findPeaks(values);
    if (peaks.length < 3) return 0;
    
    // Calculate intervals between peaks
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Calculate average and standard deviation
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // More consistent intervals = higher periodicity score
    // Normalized coefficient of variation (lower is better)
    const cv = avg > 0 ? stdDev / avg : 1;
    
    // Convert to score (0-1)
    return Math.max(0, Math.min(1, 1 - cv));
  }
  
  /**
   * Calculate quality for a specific channel
   */
  private calculateChannelQuality(values: number[], channelName: string): number {
    if (values.length < 10) return 0;
    
    // Get recent values
    const recent = values.slice(-10);
    
    // Calculate amplitude
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const amplitude = max - min;
    
    // Calculate stability (inverse of variations)
    let stability = 0;
    const diffs = [];
    for (let i = 1; i < recent.length; i++) {
      diffs.push(Math.abs(recent[i] - recent[i-1]));
    }
    const avgDiff = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
    stability = Math.max(0, 1 - (avgDiff * 2));
    
    // For heart rate, use periodicity as a factor
    let periodicity = 0;
    if (channelName === 'heartRate' && this.channels.get('heartRate')) {
      periodicity = this.channels.get('heartRate')!.metadata.periodicityScore;
    }
    
    // Calculate quality score with weights from optimizer
    const score = 
      (amplitude > 0.05 ? amplitude / 0.3 : 0) * this.optimizedWeights.signalAmplitude + 
      stability * this.optimizedWeights.signalStability + 
      (periodicity || 0) * 0.3;
    
    // Scale to 0-100
    return Math.min(100, score * 100);
  }
  
  /**
   * Update overall signal quality based on all channels
   */
  private updateSignalQuality(): void {
    let totalQuality = 0;
    let totalWeight = 0;
    
    for (const [channelName, channel] of this.channels.entries()) {
      // Heart rate channel gets double weight
      const weight = channelName === 'heartRate' ? 2 : 1;
      totalQuality += channel.quality * weight;
      totalWeight += weight;
    }
    
    this.signalQuality = totalWeight > 0 ? totalQuality / totalWeight : 0;
  }
  
  /**
   * Get the overall signal quality (0-100)
   */
  public getSignalQuality(): number {
    return this.signalQuality;
  }
  
  /**
   * Provide feedback to the optimizer for a specific channel
   */
  public provideFeedback(channelName: string, feedback: {
    accuracy?: number;
    confidence?: number;
    errorRate?: number;
  }): void {
    const channel = this.channels.get(channelName);
    if (!channel) return;
    
    // Store feedback for future learning
    channel.metadata.lastFeedback = feedback;
    
    // Update learning based on feedback
    if (feedback.accuracy !== undefined && feedback.accuracy > 0.7) {
      // High accuracy feedback can adjust weights
      this.adjustWeights(channelName, feedback.accuracy);
    }
  }
  
  /**
   * Adjust weights based on channel performance
   */
  private adjustWeights(channelName: string, accuracy: number): void {
    // Simple weight adjustment based on accuracy
    if (accuracy > 0.8) {
      // Channel is performing well, increase its influence
      if (channelName === 'heartRate') {
        this.optimizedWeights.signalQuality = 
          Math.min(0.5, this.optimizedWeights.signalQuality + 0.01);
      }
    }
  }
  
  /**
   * Get values for a specific channel
   */
  public getChannelValues(channelName: string): number[] {
    const channel = this.channels.get(channelName);
    return channel ? [...channel.values] : [];
  }
  
  /**
   * Get a specific channel
   */
  public getChannel(channelName: string): OptimizedChannel | undefined {
    return this.channels.get(channelName);
  }
  
  /**
   * Reset optimizer state
   */
  public reset(): void {
    this.history = [];
    
    // Clear all channels
    for (const channel of this.channels.values()) {
      channel.values = [];
      channel.quality = 0;
      channel.metadata = {
        dominantFrequency: 0,
        periodicityScore: 0
      };
    }
    
    // Reset optimized parameters to defaults
    this.optimizedParameters = {
      filterStrength: 0.5,
      amplificationFactor: 1.0,
      noiseReductionLevel: 0.5,
      detectionThreshold: 0.25,
      weightDecay: 0.01
    };
    
    // Reset optimized weights to defaults
    this.optimizedWeights = {
      signalQuality: 0.4,
      signalAmplitude: 0.3,
      signalStability: 0.3
    };
    
    this.signalQuality = 0;
  }
  
  /**
   * Update configuration
   */
  public setConfig(config: Partial<AdaptiveOptimizerConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }
}
