
/**
 * Advanced signal filtering and processing pipeline
 * No simulation allowed - only real data processing
 */

export class SignalFilterPipeline {
  private readonly HP_CUTOFF = 0.5; // Hz
  private readonly LP_CUTOFF = 5.0; // Hz
  private readonly SAMPLE_RATE = 30; // Hz
  private readonly BUFFER_SIZE = 90; // 3 seconds @ 30Hz
  
  private signalBuffer: number[] = [];
  private filteredBuffer: number[] = [];
  private lastFilteredValue = 0;
  private readonly SNR_THRESHOLD = 2.5;
  
  /**
   * Apply enhanced filtering pipeline to raw signal
   */
  public processValue(rawValue: number): {
    filteredValue: number;
    snr: number;
    isStable: boolean;
  } {
    // Update buffers
    this.signalBuffer.push(rawValue);
    if (this.signalBuffer.length > this.BUFFER_SIZE) {
      this.signalBuffer.shift();
    }
    
    // Apply high-pass filter (more aggressive)
    const highPassValue = this.applyHighPassFilter(rawValue);
    
    // Apply band-pass filter centered on heart rate frequencies
    const bandPassValue = this.applyBandPassFilter(highPassValue);
    
    // Apply adaptive smoothing
    const smoothedValue = this.applyAdaptiveSmoothing(bandPassValue);
    
    // Calculate signal quality metrics
    const snr = this.calculateSNR(smoothedValue);
    const isStable = this.checkSignalStability();
    
    // Store filtered value
    this.filteredBuffer.push(smoothedValue);
    if (this.filteredBuffer.length > this.BUFFER_SIZE) {
      this.filteredBuffer.shift();
    }
    
    this.lastFilteredValue = smoothedValue;
    
    return {
      filteredValue: smoothedValue,
      snr,
      isStable
    };
  }
  
  /**
   * Enhanced high-pass filter with steeper rolloff
   */
  private applyHighPassFilter(value: number): number {
    const alpha = 0.95; // More aggressive
    
    if (this.signalBuffer.length < 2) return value;
    
    const prevValue = this.signalBuffer[this.signalBuffer.length - 2];
    return alpha * (this.lastFilteredValue + value - prevValue);
  }
  
  /**
   * Band-pass filter optimized for heart rate frequencies
   */
  private applyBandPassFilter(value: number): number {
    const lowPassAlpha = 0.4;
    const highPassAlpha = 0.95;
    
    if (this.filteredBuffer.length < 2) return value;
    
    // Two-stage filtering
    const lowPass = lowPassAlpha * value + 
                   (1 - lowPassAlpha) * this.filteredBuffer[this.filteredBuffer.length - 1];
                   
    const highPass = highPassAlpha * (this.lastFilteredValue + lowPass - 
                    this.filteredBuffer[this.filteredBuffer.length - 1]);
                    
    return highPass;
  }
  
  /**
   * Adaptive smoothing that preserves peak shapes
   */
  private applyAdaptiveSmoothing(value: number): number {
    const bufferSize = Math.min(5, this.filteredBuffer.length);
    if (bufferSize < 3) return value;
    
    const recentValues = this.filteredBuffer.slice(-bufferSize);
    const variance = this.calculateVariance(recentValues);
    
    // Adjust smoothing based on local variance
    const alpha = Math.min(0.8, Math.max(0.2, 1.0 - variance));
    
    return alpha * value + (1 - alpha) * this.lastFilteredValue;
  }
  
  /**
   * Calculate signal-to-noise ratio
   */
  private calculateSNR(value: number): number {
    if (this.filteredBuffer.length < 30) return 0;
    
    const signal = this.calculateVariance(this.filteredBuffer);
    const noise = this.calculateHighFrequencyNoise();
    
    return noise > 0 ? signal / noise : 0;
  }
  
  /**
   * Calculate local variance
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  }
  
  /**
   * Estimate high frequency noise
   */
  private calculateHighFrequencyNoise(): number {
    if (this.filteredBuffer.length < 3) return 0;
    
    let noiseSum = 0;
    for (let i = 2; i < this.filteredBuffer.length; i++) {
      const diff = this.filteredBuffer[i] - 2 * this.filteredBuffer[i-1] + this.filteredBuffer[i-2];
      noiseSum += diff * diff;
    }
    
    return noiseSum / (this.filteredBuffer.length - 2);
  }
  
  /**
   * Check signal stability
   */
  private checkSignalStability(): boolean {
    if (this.filteredBuffer.length < 30) return false;
    
    const recentVariance = this.calculateVariance(this.filteredBuffer.slice(-30));
    const threshold = 0.1 * Math.pow(this.calculateVariance(this.filteredBuffer), 2);
    
    return recentVariance < threshold;
  }
  
  /**
   * Reset all buffers and states
   */
  public reset(): void {
    this.signalBuffer = [];
    this.filteredBuffer = [];
    this.lastFilteredValue = 0;
  }
}
