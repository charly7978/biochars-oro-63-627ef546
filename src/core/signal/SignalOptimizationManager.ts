
import { AdaptiveOptimizer, OptimizedChannel } from './AdaptiveOptimizer';
import { ProcessorConfig } from '../config/ProcessorConfig';
import { ProcessedSignal } from '../types';

/**
 * Interface for signal optimization results
 */
export interface OptimizationResult {
  heartRate: {
    value: number;
    confidence: number;
  };
  optimizedChannels: Map<string, OptimizedChannel>;
  signalQuality: number;
  isDominantFrequencyValid: boolean;
  dominantFrequency: number;
}

/**
 * Signal Optimization Manager
 * 
 * Coordinates processing between different optimized channels
 * and provides a unified interface for higher-level components
 */
export class SignalOptimizationManager {
  private optimizer: AdaptiveOptimizer;
  private lastOptimizationResult: OptimizationResult | null = null;
  private signalBuffer: number[] = [];
  private readonly bufferMaxSize: number = 300;
  
  // Heart rate state
  private lastHeartRateBpm: number = 0;
  private lastConfidence: number = 0;
  private heartRateBuffer: number[] = [];
  private readonly HR_BUFFER_SIZE = 5;
  
  // Quality thresholds
  private readonly QUALITY_THRESHOLD_LOW = 30;
  private readonly QUALITY_THRESHOLD_MEDIUM = 60;
  private readonly QUALITY_THRESHOLD_HIGH = 80;
  
  /**
   * Constructor for the optimization manager
   */
  constructor(config: ProcessorConfig) {
    // Convert ProcessorConfig to AdaptiveOptimizerConfig
    const optimizerConfig = {
      learningRate: 0.15,
      adaptationWindow: 20,
      thresholds: {
        signalQuality: 0.5,
        signalAmplitude: 0.1,
        signalStability: 0.3
      }
    };
    
    this.optimizer = new AdaptiveOptimizer(optimizerConfig);
  }
  
  /**
   * Process a new signal and return optimized result
   */
  public processSignal(signal: ProcessedSignal): OptimizationResult {
    // Extract filtered value from signal
    const { filteredValue } = signal;
    
    // Store in buffer
    this.signalBuffer.push(filteredValue);
    if (this.signalBuffer.length > this.bufferMaxSize) {
      this.signalBuffer.shift();
    }
    
    // Process with adaptive optimizer
    const optimizedChannels = this.optimizer.processValue(filteredValue);
    
    // Check heart rate channel
    const heartRateChannel = optimizedChannels.get('heartRate');
    
    // Calculate heart rate if enough data
    let heartRate = this.lastHeartRateBpm;
    let confidence = this.lastConfidence;
    let dominantFrequency = 0;
    let isDominantFrequencyValid = false;
    
    if (heartRateChannel && heartRateChannel.values.length > 60) {
      // Get dominant frequency from channel
      dominantFrequency = heartRateChannel.metadata.dominantFrequency;
      
      // Convert frequency to BPM
      if (dominantFrequency > 0.5 && dominantFrequency < 3.5) {
        const bpm = dominantFrequency * 60;
        isDominantFrequencyValid = true;
        
        // Verify physiological range
        if (bpm >= 40 && bpm <= 200) {
          // Store in frequency buffer
          this.heartRateBuffer.push(bpm);
          if (this.heartRateBuffer.length > this.HR_BUFFER_SIZE) {
            this.heartRateBuffer.shift();
          }
          
          // Calculate weighted average
          let weightedSum = 0;
          let weightSum = 0;
          
          for (let i = 0; i < this.heartRateBuffer.length; i++) {
            const weight = (i + 1); // Give more weight to recent values
            weightedSum += this.heartRateBuffer[i] * weight;
            weightSum += weight;
          }
          
          heartRate = Math.round(weightedSum / weightSum);
          
          // Calculate confidence based on channel quality and periodicity score
          confidence = Math.min(1, 
            (heartRateChannel.quality / 100) * 0.6 + 
            heartRateChannel.metadata.periodicityScore * 0.4
          );
          
          // Update state values
          this.lastHeartRateBpm = heartRate;
          this.lastConfidence = confidence;
        }
      }
    }
    
    // Calculate overall quality
    const signalQuality = this.optimizer.getSignalQuality();
    
    // Provide feedback to optimizer
    this.provideFeedbackToOptimizer(optimizedChannels, heartRate, confidence);
    
    // Build optimization result
    const result: OptimizationResult = {
      heartRate: {
        value: heartRate,
        confidence: confidence
      },
      optimizedChannels,
      signalQuality,
      dominantFrequency,
      isDominantFrequencyValid
    };
    
    // Store result
    this.lastOptimizationResult = result;
    
    return result;
  }
  
  /**
   * Provide feedback to optimizer to improve future processing
   */
  private provideFeedbackToOptimizer(
    channels: Map<string, OptimizedChannel>,
    heartRate: number,
    confidence: number
  ): void {
    // Feedback for heart rate channel
    if (channels.has('heartRate')) {
      const hrQuality = channels.get('heartRate')!.quality;
      
      // Provide accuracy metric based on stability
      let accuracy = 0;
      
      if (this.heartRateBuffer.length >= 3) {
        // Calculate standard deviation
        const mean = this.heartRateBuffer.reduce((sum, hr) => sum + hr, 0) / this.heartRateBuffer.length;
        const variance = this.heartRateBuffer.reduce((sum, hr) => sum + Math.pow(hr - mean, 2), 0) / 
                        this.heartRateBuffer.length;
        const stdDev = Math.sqrt(variance);
        
        // High accuracy = low relative standard deviation
        accuracy = Math.max(0, Math.min(1, 1 - (stdDev / mean) / 0.1));
      }
      
      this.optimizer.provideFeedback('heartRate', {
        accuracy,
        confidence,
        errorRate: 1 - confidence
      });
    }
    
    // Feedback for other channels based on heart rate channel performance
    // (as it's the reference channel for validation)
    if (confidence > 0.7) {
      for (const [channelName, _] of channels.entries()) {
        if (channelName !== 'heartRate') {
          this.optimizer.provideFeedback(channelName, {
            confidence: confidence * 0.8,
            accuracy: confidence * 0.7
          });
        }
      }
    }
  }
  
  /**
   * Get last optimization result
   */
  public getLastResult(): OptimizationResult | null {
    return this.lastOptimizationResult;
  }
  
  /**
   * Get values for a specific channel
   */
  public getChannelValues(channelName: string): number[] {
    return this.optimizer.getChannelValues(channelName);
  }
  
  /**
   * Get complete channel with metadata
   */
  public getChannel(channelName: string): OptimizedChannel | undefined {
    return this.optimizer.getChannel(channelName);
  }
  
  /**
   * Reset optimizer state
   */
  public reset(): void {
    this.optimizer.reset();
    this.signalBuffer = [];
    this.lastHeartRateBpm = 0;
    this.lastConfidence = 0;
    this.heartRateBuffer = [];
    this.lastOptimizationResult = null;
  }
  
  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ProcessorConfig>): void {
    // Convert ProcessorConfig to AdaptiveOptimizerConfig
    const optimizerConfig = {
      learningRate: 0.15,
      adaptationWindow: 20,
      thresholds: {
        signalQuality: 0.5,
        signalAmplitude: 0.1,
        signalStability: 0.3
      }
    };
    
    this.optimizer.setConfig(optimizerConfig);
  }
}
