/**
 * SignalAmplifier.ts
 * 
 * This module optimizes the PPG signal extracted from the finger to improve heartbeat detection
 * using adaptive amplification, noise filtering, and periodicity detection techniques.
 */

export class SignalAmplifier {
  // Amplification parameters
  private readonly MIN_GAIN = 1.2;
  private readonly MAX_GAIN = 4.5;
  private readonly NOISE_THRESHOLD = 0.15;
  private readonly SIGNAL_BUFFER_SIZE = 20;
  private readonly LONG_BUFFER_SIZE = 60;
  private readonly ADAPTATION_RATE = 0.08;
  private readonly FREQUENCY_BANDS = [0.8, 1.0, 1.3, 1.6, 2.0, 2.3, 2.6];
  private readonly QUALITY_THRESHOLDS = {
    LOW: 0.3,
    MEDIUM: 0.6,
    HIGH: 0.8
  };

  // Buffers and state
  private signalBuffer: number[] = [];
  private longTermBuffer: number[] = [];
  private baselineValue = 0;
  private currentGain = 2.0;
  private lastQuality = 0;
  private dominantFrequency = 0;
  private lastValues: number[] = [];
  private readonly LAST_VALUES_SIZE = 5;
  private lastAmplifiedValues: number[] = [];

  constructor() {
    this.reset();
  }

  /**
   * Process and amplify a raw PPG value
   */
  public processValue(rawValue: number): { 
    amplifiedValue: number; 
    quality: number;
    dominantFrequency: number;
  } {
    // Normalize value relative to baseline
    this.updateBaseline(rawValue);
    const normalizedValue = rawValue - this.baselineValue;
    
    // Store in buffer for analysis
    this.signalBuffer.push(normalizedValue);
    this.longTermBuffer.push(normalizedValue);
    
    if (this.signalBuffer.length > this.SIGNAL_BUFFER_SIZE) {
      this.signalBuffer.shift();
    }
    
    if (this.longTermBuffer.length > this.LONG_BUFFER_SIZE) {
      this.longTermBuffer.shift();
    }
    
    // Keep track of recent raw values for analysis
    this.lastValues.push(rawValue);
    if (this.lastValues.length > this.LAST_VALUES_SIZE) {
      this.lastValues.shift();
    }
    
    // Analyze signal quality
    const signalQuality = this.calculateSignalQuality();
    
    // Dynamically adjust gain based on quality
    this.adjustGain(signalQuality);
    
    // Detect periodicity and calculate dominant frequency 
    if (this.longTermBuffer.length > 30) {
      this.dominantFrequency = this.detectDominantFrequency();
    }
    
    // Apply adaptive amplification, emphasizing periodic components
    const amplifiedValue = this.applyAdaptiveAmplification(normalizedValue);
    
    // Update amplified values history
    this.lastAmplifiedValues.push(amplifiedValue);
    if (this.lastAmplifiedValues.length > this.LAST_VALUES_SIZE) {
      this.lastAmplifiedValues.shift();
    }
    
    return { 
      amplifiedValue,
      quality: signalQuality,
      dominantFrequency: this.dominantFrequency
    };
  }

  /**
   * Update baseline with slow adaptation
   */
  private updateBaseline(value: number): void {
    if (this.baselineValue === 0) {
      this.baselineValue = value;
    } else {
      const adaptationRate = 0.005; // Very slow for stability
      this.baselineValue = this.baselineValue * (1 - adaptationRate) + value * adaptationRate;
    }
  }

  /**
   * Calculate signal quality based on multiple factors
   */
  private calculateSignalQuality(): number {
    if (this.signalBuffer.length < 10) {
      return this.lastQuality; // Maintain last quality until enough data
    }
    
    // Calculate amplitude range (min to max)
    const max = Math.max(...this.signalBuffer);
    const min = Math.min(...this.signalBuffer);
    const range = max - min;
    
    // Calculate short-term variability (differences between consecutive samples)
    let variabilitySum = 0;
    for (let i = 1; i < this.signalBuffer.length; i++) {
      variabilitySum += Math.abs(this.signalBuffer[i] - this.signalBuffer[i-1]);
    }
    const avgVariability = variabilitySum / (this.signalBuffer.length - 1);
    
    // Calculate periodicity (simple autocorrelation)
    const periodicityScore = this.calculatePeriodicityScore();
    
    // Calculate noise (high-frequency components)
    const noiseScore = this.calculateNoiseScore();
    
    // Calculate baseline stability
    const baselineStability = this.calculateBaselineStability();
    
    // Weight factors for final quality
    // Greater weight to periodicity and less to noise
    const rawQuality = (
      (range * 0.3) +                 // 30% amplitude 
      (periodicityScore * 0.4) +      // 40% periodicity
      ((1 - noiseScore) * 0.2) +      // 20% absence of noise
      (baselineStability * 0.1)       // 10% stability
    );
    
    // Normalize to 0-1
    const normalizedQuality = Math.min(1, Math.max(0, rawQuality));
    
    // Apply smoothing to avoid sudden changes
    this.lastQuality = this.lastQuality * 0.7 + normalizedQuality * 0.3;
    
    return this.lastQuality;
  }

  /**
   * Calculate periodicity score based on autocorrelation
   */
  private calculatePeriodicityScore(): number {
    if (this.signalBuffer.length < 10) return 0;
    
    const buffer = [...this.signalBuffer];
    const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    
    // Normalize the buffer
    const normalizedBuffer = buffer.map(v => v - mean);
    
    let maxCorrelation = 0;
    
    // Search for correlations in normal heartbeat ranges (40-180 BPM)
    // This corresponds approximately to periods of 15-30 samples at 30fps
    const minLag = 4;
    const maxLag = 20;
    
    for (let lag = minLag; lag <= maxLag; lag++) {
      let correlation = 0;
      let norm1 = 0;
      let norm2 = 0;
      
      for (let i = 0; i < normalizedBuffer.length - lag; i++) {
        correlation += normalizedBuffer[i] * normalizedBuffer[i + lag];
        norm1 += normalizedBuffer[i] * normalizedBuffer[i];
        norm2 += normalizedBuffer[i + lag] * normalizedBuffer[i + lag];
      }
      
      // Normalize correlation to [-1, 1]
      const normalizedCorrelation = norm1 > 0 && norm2 > 0 ? 
        correlation / Math.sqrt(norm1 * norm2) : 0;
      
      // We take the absolute value because we're interested in correlation
      // regardless of sign
      const absCorrelation = Math.abs(normalizedCorrelation);
      
      if (absCorrelation > maxCorrelation) {
        maxCorrelation = absCorrelation;
      }
    }
    
    // Transform to a non-linear score that rewards high correlations
    return Math.pow(maxCorrelation, 1.5);
  }

  /**
   * Estimate noise level in the signal
   */
  private calculateNoiseScore(): number {
    if (this.signalBuffer.length < 10) return 1.0;
    
    // Calculate first derivative (changes between samples)
    const derivatives: number[] = [];
    for (let i = 1; i < this.signalBuffer.length; i++) {
      derivatives.push(this.signalBuffer[i] - this.signalBuffer[i-1]);
    }
    
    // Calculate second derivative (changes in changes)
    const secondDerivatives: number[] = [];
    for (let i = 1; i < derivatives.length; i++) {
      secondDerivatives.push(derivatives[i] - derivatives[i-1]);
    }
    
    // Noise manifests as rapid changes in the second derivative
    // Calculate mean absolute value of second derivative
    const meanAbsSecondDerivative = secondDerivatives.reduce(
      (sum, val) => sum + Math.abs(val), 0
    ) / secondDerivatives.length;
    
    // Normalize to [0,1] using an adaptive threshold
    const normalizedNoise = Math.min(
      1.0, 
      meanAbsSecondDerivative / (this.NOISE_THRESHOLD * Math.max(0.2, this.currentGain))
    );
    
    return normalizedNoise;
  }

  /**
   * Calculate baseline stability
   */
  private calculateBaselineStability(): number {
    if (this.lastValues.length < this.LAST_VALUES_SIZE) return 0.5;
    
    // Calculate standard deviation of original values
    const mean = this.lastValues.reduce((a, b) => a + b, 0) / this.lastValues.length;
    const variance = this.lastValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.lastValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize: lower deviation = greater stability
    // Use an adaptive threshold based on current gain
    const normalizedStability = Math.max(0, 1 - (stdDev / (10 * this.currentGain)));
    
    return normalizedStability;
  }

  /**
   * Dynamically adjust gain based on signal quality
   */
  private adjustGain(quality: number): void {
    // If quality is very low, increase gain
    // If quality is good, we can reduce gain
    let targetGain = this.currentGain;
    
    if (quality < this.QUALITY_THRESHOLDS.LOW) {
      // Low quality, gradually increase gain
      targetGain = Math.min(this.MAX_GAIN, this.currentGain * 1.05);
    } else if (quality < this.QUALITY_THRESHOLDS.MEDIUM) {
      // Medium quality, slightly increase
      targetGain = Math.min(this.MAX_GAIN, this.currentGain * 1.01);
    } else if (quality > this.QUALITY_THRESHOLDS.HIGH) {
      // High quality, reduce to avoid saturation
      targetGain = Math.max(this.MIN_GAIN, this.currentGain * 0.99);
    }
    
    // Apply smoothed change
    this.currentGain = this.currentGain * (1 - this.ADAPTATION_RATE) + 
                      targetGain * this.ADAPTATION_RATE;
  }

  /**
   * Detect dominant frequency (heart rate) in the signal
   */
  private detectDominantFrequency(): number {
    if (this.longTermBuffer.length < 30) return 0;
    
    const buffer = this.longTermBuffer.slice(-30);
    const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
    const normalized = buffer.map(v => v - mean);
    
    // Simplified simulation of frequency analysis
    // Examine correlation at different frequency bands typical of heart rate
    const freqScores: {freq: number, score: number}[] = [];
    
    for (const freq of this.FREQUENCY_BANDS) {
      // Convert frequency (Hz) to period in samples (assuming ~30fps)
      const period = Math.round(30 / freq);
      if (period < 4 || period > buffer.length / 2) continue;
      
      let score = 0;
      
      // Examine correlation at current frequency
      for (let lag = period - 1; lag <= period + 1; lag++) {
        if (lag >= buffer.length - 5) continue;
        
        let correlation = 0;
        for (let i = 0; i < buffer.length - lag; i++) {
          correlation += normalized[i] * normalized[i + lag];
        }
        
        score = Math.max(score, Math.abs(correlation));
      }
      
      freqScores.push({freq, score});
    }
    
    // Find frequency with highest score
    let maxScore = 0;
    let dominantFreq = 0;
    
    for (const {freq, score} of freqScores) {
      if (score > maxScore) {
        maxScore = score;
        dominantFreq = freq;
      }
    }
    
    return dominantFreq;
  }

  /**
   * Apply adaptive amplification considering periodic components
   */
  private applyAdaptiveAmplification(normalizedValue: number): number {
    // Basic amplification
    let amplifiedValue = normalizedValue * this.currentGain;
    
    // Apply selective enhancement if we have a dominant frequency
    if (this.dominantFrequency > 0 && this.lastQuality > this.QUALITY_THRESHOLDS.LOW) {
      // Calculate approximate period in samples
      const dominantPeriod = Math.round(30 / this.dominantFrequency);
      
      // If we have enough values in the buffer
      if (this.signalBuffer.length >= dominantPeriod) {
        // Predict periodic component based on previous samples
        let periodicComponent = 0;
        let count = 0;
        
        // Average values at distances of multiples of the period
        for (let k = 1; k <= 3; k++) {
          const idx = this.signalBuffer.length - k * dominantPeriod;
          if (idx >= 0) {
            periodicComponent += this.signalBuffer[idx];
            count++;
          }
        }
        
        if (count > 0) {
          periodicComponent /= count;
          
          // Enhance periodic components
          const emphasisFactor = 0.3 * Math.min(1.0, this.lastQuality * 1.5);
          amplifiedValue = amplifiedValue * (1 - emphasisFactor) + 
                          periodicComponent * this.currentGain * emphasisFactor;
        }
      }
    }
    
    // Apply soft limiting to avoid extreme values
    const softLimit = (x: number, limit: number): number => {
      if (Math.abs(x) < limit) return x;
      const sign = x >= 0 ? 1 : -1;
      return sign * (limit + Math.log(1 + Math.abs(x) - limit));
    };
    
    const limitThreshold = 5.0;
    amplifiedValue = softLimit(amplifiedValue, limitThreshold);
    
    return amplifiedValue;
  }

  /**
   * Reset amplifier state
   */
  public reset(): void {
    this.signalBuffer = [];
    this.longTermBuffer = [];
    this.baselineValue = 0;
    this.currentGain = 2.0;
    this.lastQuality = 0;
    this.dominantFrequency = 0;
    this.lastValues = [];
    this.lastAmplifiedValues = [];
  }

  /**
   * Get current gain
   */
  public getCurrentGain(): number {
    return this.currentGain;
  }
}
