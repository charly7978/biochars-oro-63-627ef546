
/**
 * Signal Optimizer
 * Optimizes and enhances PPG signals with adaptive processing
 */

import { EventType, eventBus } from '../events/EventBus';
import { PPGSignal, ProcessingError } from '../types/signal';
import { CircularBuffer } from '../../utils/CircularBuffer';

export class SignalOptimizer {
  // Buffers for signal analysis
  private signalHistory = new CircularBuffer<number>(30);
  private qualityHistory = new CircularBuffer<number>(10);
  
  // Optimization state
  private adaptiveGain: number = 1.0;
  private noiseThreshold: number = 0.05;
  private baselineOffset: number = 0;
  private isOptimizing: boolean = false;
  private optimizationCount: number = 0;
  
  // Constants
  private readonly MIN_OPTIMIZATION_INTERVAL = 10;
  private readonly MAX_GAIN = 3.0;
  private readonly MIN_GAIN = 0.5;
  private readonly ADAPTATION_RATE = 0.1;
  
  constructor() {
    // Subscribe to PPG signal events
    eventBus.subscribe(EventType.SIGNAL_EXTRACTED, this.optimizeSignal.bind(this));
    
    // Subscribe to monitoring state events
    eventBus.subscribe(EventType.MONITORING_RESET, this.reset.bind(this));
    
    console.log('Signal Optimizer initialized');
  }
  
  /**
   * Optimize incoming PPG signal
   */
  private optimizeSignal(signal: PPGSignal): void {
    try {
      // Skip optimization if finger is not detected
      if (!signal.fingerDetected) return;
      
      // Add to history buffers
      this.signalHistory.push(signal.filteredValue);
      this.qualityHistory.push(signal.quality);
      
      // Increment optimization counter
      this.optimizationCount++;
      
      // Skip optimization if not enough data or too frequent
      if (this.signalHistory.getValues().length < 5 || 
          this.optimizationCount % this.MIN_OPTIMIZATION_INTERVAL !== 0) {
        return;
      }
      
      this.isOptimizing = true;
      
      // Get signal statistics
      const values = this.signalHistory.getValues();
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      
      // Calculate signal-to-noise ratio estimate
      const snr = this.estimateSignalToNoiseRatio(values);
      
      // Determine if signal needs optimization
      const avgQuality = this.calculateAverageQuality();
      const needsAmplification = range < 0.5 || avgQuality < 50;
      const needsNoiseSuppression = snr < 2.0;
      
      let optimized = false;
      
      // Apply optimizations
      if (needsAmplification) {
        this.adaptGain(range);
        optimized = true;
      }
      
      if (needsNoiseSuppression) {
        this.updateNoiseThreshold(values);
        optimized = true;
      }
      
      if (optimized) {
        // Create optimization feedback
        const optimization = {
          timestamp: Date.now(),
          adaptiveGain: this.adaptiveGain,
          noiseThreshold: this.noiseThreshold,
          signalQuality: avgQuality,
          snr: snr
        };
        
        // Publish optimization event
        eventBus.publish(EventType.OPTIMIZATION_APPLIED, optimization);
        
        // Publish feedback for other processors
        eventBus.publish(EventType.PROCESSOR_FEEDBACK, {
          type: 'SIGNAL_OPTIMIZATION',
          data: optimization
        });
      }
      
      this.isOptimizing = false;
    } catch (error) {
      console.error('Error optimizing signal:', error);
      const processingError: ProcessingError = {
        code: 'SIGNAL_OPTIMIZATION_ERROR',
        message: error instanceof Error ? error.message : 'Error optimizing signal',
        timestamp: Date.now(),
        source: 'SignalOptimizer'
      };
      eventBus.publish(EventType.ERROR_OCCURRED, processingError);
      this.isOptimizing = false;
    }
  }
  
  /**
   * Adaptively adjust gain based on signal amplitude
   */
  private adaptGain(signalRange: number): void {
    // Target range for optimal signal amplitude
    const targetRange = 1.0;
    
    // Calculate ideal gain for this range
    const idealGain = signalRange > 0 ? targetRange / signalRange : this.adaptiveGain;
    
    // Limit gain to reasonable bounds
    const boundedIdealGain = Math.min(this.MAX_GAIN, Math.max(this.MIN_GAIN, idealGain));
    
    // Adapt current gain gradually
    this.adaptiveGain = (1 - this.ADAPTATION_RATE) * this.adaptiveGain + 
                        this.ADAPTATION_RATE * boundedIdealGain;
    
    console.log(`Adapted signal gain to ${this.adaptiveGain.toFixed(2)}`);
  }
  
  /**
   * Update noise threshold based on signal statistics
   */
  private updateNoiseThreshold(values: number[]): void {
    // Calculate variance
    const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
    const sumSquaredDiff = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
    const variance = sumSquaredDiff / values.length;
    
    // Noise threshold is proportional to signal variance
    const newThreshold = Math.sqrt(variance) * 0.3;
    
    // Update threshold with smoothing
    this.noiseThreshold = (1 - this.ADAPTATION_RATE) * this.noiseThreshold + 
                          this.ADAPTATION_RATE * newThreshold;
    
    console.log(`Updated noise threshold to ${this.noiseThreshold.toFixed(4)}`);
  }
  
  /**
   * Estimate signal-to-noise ratio
   */
  private estimateSignalToNoiseRatio(values: number[]): number {
    if (values.length < 10) return 1.0;
    
    // Simplified SNR estimation using peak-to-peak vs. local variance
    const min = Math.min(...values);
    const max = Math.max(...values);
    const peakToPeak = max - min;
    
    // Calculate local variations (estimate of noise)
    let sumLocalVariation = 0;
    for (let i = 1; i < values.length; i++) {
      sumLocalVariation += Math.abs(values[i] - values[i-1]);
    }
    const avgLocalVariation = sumLocalVariation / (values.length - 1);
    
    // SNR = signal / noise
    return avgLocalVariation > 0 ? peakToPeak / avgLocalVariation : 1.0;
  }
  
  /**
   * Apply optimization to a signal value
   */
  applyOptimization(value: number): number {
    // Apply current optimizations to a value
    return value * this.adaptiveGain;
  }
  
  /**
   * Apply noise suppression to a value
   */
  suppressNoise(value: number, previousValue: number): number {
    // Simple noise suppression - if change is below threshold, dampen it
    const change = value - previousValue;
    if (Math.abs(change) < this.noiseThreshold) {
      return previousValue + change * 0.5;
    }
    return value;
  }
  
  /**
   * Calculate average quality from recent measurements
   */
  private calculateAverageQuality(): number {
    const qualities = this.qualityHistory.getValues();
    if (qualities.length === 0) return 0;
    
    return Math.round(
      qualities.reduce((acc, val) => acc + val, 0) / qualities.length
    );
  }
  
  /**
   * Get current optimization parameters
   */
  getOptimizationParams(): {
    gain: number;
    noiseThreshold: number;
    isOptimizing: boolean;
  } {
    return {
      gain: this.adaptiveGain,
      noiseThreshold: this.noiseThreshold,
      isOptimizing: this.isOptimizing
    };
  }
  
  /**
   * Reset optimizer state
   */
  reset(): void {
    this.signalHistory.clear();
    this.qualityHistory.clear();
    this.adaptiveGain = 1.0;
    this.noiseThreshold = 0.05;
    this.baselineOffset = 0;
    this.isOptimizing = false;
    this.optimizationCount = 0;
    
    console.log('Signal Optimizer reset');
  }
}

// Export singleton instance
export const signalOptimizer = new SignalOptimizer();
