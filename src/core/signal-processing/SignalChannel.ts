
/**
 * Signal Channel - Represents a specialized processing channel for a specific vital sign
 * Enhanced with real-time neural processing and bidirectional feedback
 */

import { 
  SignalChannelConfig, 
  SignalFeedback, 
  ChannelMetadata,
  OptimizationLevel
} from './types';
import { TensorFlowWorkerClient } from '../../workers/tensorflow-worker-client';

// Cliente singleton para TensorFlow
let tfWorkerClient: TensorFlowWorkerClient | null = null;

export class SignalChannel {
  private readonly name: string;
  private readonly bufferSize: number;
  private values: number[] = [];
  private metadata: Map<string, ChannelMetadata> = new Map();
  private readonly config: SignalChannelConfig;
  private gain: number = 1.0;
  private baseline: number = 0;
  private qualityHistory: number[] = [];
  private readonly QUALITY_HISTORY_SIZE = 10;
  private isModelReady: boolean = false;
  private lastFeedback: SignalFeedback | null = null;
  private readonly isCardiacChannel: boolean;
  private linkedChannels: Map<string, SignalChannel> = new Map();
  private channelCorrelations: Map<string, number> = new Map();
  
  constructor(name: string, bufferSize: number = 300, config?: SignalChannelConfig) {
    this.name = name;
    this.bufferSize = bufferSize;
    this.config = config || {
      sampleRate: 30,
      feedbackEnabled: true,
      optimizationLevel: 'medium'
    };
    this.isCardiacChannel = name === 'cardiac';
    console.log(`SignalChannel: Created new optimized channel "${name}" with buffer size ${bufferSize}`);
    
    // Initialize TensorFlow integration for real-time processing
    this.initializeTensorFlow();
  }
  
  /**
   * Initialize TensorFlow for real-time neural processing
   */
  private async initializeTensorFlow(): Promise<void> {
    try {
      if (!tfWorkerClient) {
        console.log(`SignalChannel ${this.name}: Inicializando TensorFlow Worker`);
        tfWorkerClient = new TensorFlowWorkerClient();
        await tfWorkerClient.initialize();
      }
      
      // Only load model if this channel needs it
      if (this.isCardiacChannel || this.name === 'bloodPressure' || this.name === 'spo2') {
        const modelType = this.isCardiacChannel ? 'heartRate' : this.name;
        await tfWorkerClient.loadModel(modelType);
        this.isModelReady = true;
        console.log(`SignalChannel ${this.name}: Modelo TensorFlow ${modelType} cargado exitosamente`);
      }
    } catch (error) {
      console.error(`SignalChannel ${this.name}: Error inicializando TensorFlow:`, error);
      this.isModelReady = false;
    }
  }
  
  /**
   * Link this channel with other channels for bidirectional feedback
   */
  public linkChannel(channel: SignalChannel): void {
    if (channel.getName() !== this.name) {
      this.linkedChannels.set(channel.getName(), channel);
      console.log(`SignalChannel: Linked channel ${this.name} with ${channel.getName()} for bidirectional feedback`);
    }
  }
  
  /**
   * Process bidirectional feedback between channels
   */
  private processBidirectionalFeedback(): void {
    if (this.linkedChannels.size === 0 || this.values.length < 30) return;
    
    // Calculate correlations with linked channels
    this.linkedChannels.forEach((channel, channelName) => {
      const otherValues = channel.getValues();
      if (otherValues.length >= 30) {
        const correlation = this.calculateCorrelation(
          this.values.slice(-30), 
          otherValues.slice(-30)
        );
        this.channelCorrelations.set(channelName, correlation);
        
        // Share quality feedback if there's strong correlation
        if (Math.abs(correlation) > 0.7) {
          const myQuality = this.calculateSignalQuality();
          const otherQuality = channel.getLastFeedback()?.quality || 0;
          
          // Bidirectional quality enhancement
          if (myQuality > otherQuality + 20) {
            // Share our processing parameters with the other channel
            const suggestions = this.generateOptimizationSuggestions();
            if (suggestions && suggestions.filters) {
              channel.applyFeedbackSuggestions(suggestions);
            }
          }
        }
      }
    });
  }
  
  /**
   * Calculate correlation between two signals
   */
  private calculateCorrelation(signal1: number[], signal2: number[]): number {
    if (signal1.length !== signal2.length || signal1.length === 0) return 0;
    
    const n = signal1.length;
    let sum1 = 0, sum2 = 0, sum1Sq = 0, sum2Sq = 0, pSum = 0;
    
    for (let i = 0; i < n; i++) {
      sum1 += signal1[i];
      sum2 += signal2[i];
      sum1Sq += signal1[i] ** 2;
      sum2Sq += signal2[i] ** 2;
      pSum += signal1[i] * signal2[i];
    }
    
    const num = pSum - (sum1 * sum2 / n);
    const den = Math.sqrt((sum1Sq - sum1 ** 2 / n) * (sum2Sq - sum2 ** 2 / n));
    
    return den === 0 ? 0 : num / den;
  }
  
  /**
   * Get last calculated feedback
   */
  public getLastFeedback(): SignalFeedback | null {
    return this.lastFeedback;
  }
  
  /**
   * Apply feedback suggestions from other channels
   */
  public applyFeedbackSuggestions(feedback: SignalFeedback): void {
    if (feedback.gainAdjustment) {
      // Adjust gain gradually
      this.gain = this.gain * 0.8 + feedback.gainAdjustment * 0.2;
      console.log(`SignalChannel ${this.name}: Applied gain adjustment: ${this.gain}`);
    }
    
    if (feedback.baselineCorrection) {
      // Adjust baseline gradually
      this.baseline = this.baseline * 0.8 + feedback.baselineCorrection * 0.2;
      console.log(`SignalChannel ${this.name}: Applied baseline correction: ${this.baseline}`);
    }
    
    // Store last feedback
    this.lastFeedback = feedback;
  }
  
  /**
   * Add a new value to the channel with metadata
   */
  public addValue(value: number, metadata: ChannelMetadata): void {
    // Apply gain and baseline correction
    const processedValue = (value * this.gain) + this.baseline;
    
    this.values.push(processedValue);
    this.metadata.set(metadata.timestamp.toString(), metadata);
    
    // Auto-trim when adding new values
    if (this.values.length > this.bufferSize) {
      this.trimHistory(this.bufferSize);
    }
    
    // Process bidirectional feedback if this is a special channel
    if (this.isCardiacChannel || this.config.optimizationLevel === 'high') {
      this.processBidirectionalFeedback();
    }
  }
  
  /**
   * Add a new value to the channel with real-time feedback
   */
  public async addValueWithFeedback(value: number, metadata: ChannelMetadata): Promise<SignalFeedback> {
    this.addValue(value, metadata);

    if (!this.config.feedbackEnabled) {
      return { quality: 100, needsOptimization: false };
    }

    // Calculate signal quality
    const quality = this.calculateSignalQuality();
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }

    // Determine if optimization is needed
    const needsOptimization = this.shouldOptimize();
    
    // Generate optimization suggestions if needed
    const feedback: SignalFeedback = {
      quality,
      needsOptimization
    };

    if (needsOptimization) {
      feedback.optimizationSuggestions = this.generateOptimizationSuggestions();
    }
    
    // Try to enhance with neural network if available
    if (this.isModelReady && tfWorkerClient && this.values.length >= 100) {
      try {
        const feedbackInput = this.values.slice(-100);
        const normalizedInput = this.normalizeSignal(feedbackInput);
        
        // Use appropriate model based on channel type
        const modelType = this.isCardiacChannel ? 'heartRate' : 
                          (this.name === 'bloodPressure' || this.name === 'spo2') ? 
                          this.name : null;
        
        if (modelType) {
          const prediction = await tfWorkerClient.predict(modelType, normalizedInput);
          
          // Enhanced feedback based on neural prediction
          if (prediction && prediction.length > 0) {
            // Enhanced confidence from neural model
            feedback.neuralConfidence = prediction[0];
            
            if (feedback.optimizationSuggestions) {
              // Neural suggested gain adjustment
              feedback.optimizationSuggestions.neuralGainSuggestion = 
                this.gain * (0.8 + 0.4 * prediction[0]);
            }
          }
        }
      } catch (error) {
        console.error(`SignalChannel ${this.name}: Error en predicción neural para feedback:`, error);
      }
    }

    this.lastFeedback = feedback;
    return feedback;
  }
  
  /**
   * Normalize signal for neural network input
   */
  private normalizeSignal(signal: number[]): number[] {
    if (signal.length === 0) return [];
    
    // Find min and max for normalization
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const range = max - min;
    
    // Avoid division by zero
    if (range === 0) return signal.map(() => 0.5);
    
    // Normalize to [0,1] range
    return signal.map(val => (val - min) / range);
  }
  
  /**
   * Get all values in the channel
   */
  public getValues(): number[] {
    return this.values;
  }
  
  /**
   * Get the latest value
   */
  public getLastValue(): number | null {
    if (this.values.length === 0) return null;
    return this.values[this.values.length - 1];
  }
  
  /**
   * Get the metadata for a specific timestamp
   */
  public getMetadata(key: string): any {
    return this.metadata.get(key);
  }
  
  /**
   * Get the latest metadata
   */
  public getLastMetadata(): any {
    if (this.values.length === 0) return null;
    const lastKey = this.values.length - 1;
    return this.metadata.get(lastKey.toString());
  }
  
  /**
   * Store custom metadata for the channel
   */
  public setMetadata(key: string, value: any): void {
    this.metadata.set(key, value);
  }
  
  /**
   * Get the channel name
   */
  public getName(): string {
    return this.name;
  }
  
  /**
   * Reset the channel to its initial state
   */
  public reset(): void {
    this.values = [];
    this.metadata.clear();
    this.qualityHistory = [];
    this.gain = 1.0;
    this.baseline = 0;
    this.channelCorrelations.clear();
    console.log(`SignalChannel: Reset channel "${this.name}"`);
  }

  /**
   * Calculate signal quality based on multiple factors
   */
  private calculateSignalQuality(): number {
    if (this.values.length < 2) return 100;

    // Calcular calidad basada en varios factores
    const amplitudeQuality = this.calculateAmplitudeQuality();
    const noiseQuality = this.calculateNoiseQuality();
    const stabilityQuality = this.calculateStabilityQuality();

    // Weighted average of quality factors
    return Math.round(
      (amplitudeQuality * 0.4) +
      (noiseQuality * 0.3) +
      (stabilityQuality * 0.3)
    );
  }

  private calculateAmplitudeQuality(): number {
    const recentValues = this.values.slice(-30);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Normalize to 0-100
    return Math.min(100, Math.max(0, amplitude * 100));
  }

  private calculateNoiseQuality(): number {
    const recentValues = this.values.slice(-30);
    let noiseLevel = 0;
    
    for (let i = 1; i < recentValues.length; i++) {
      noiseLevel += Math.abs(recentValues[i] - recentValues[i-1]);
    }
    
    noiseLevel /= (recentValues.length - 1);
    
    // Convert to quality (less noise = higher quality)
    return Math.min(100, Math.max(0, 100 - (noiseLevel * 100)));
  }

  private calculateStabilityQuality(): number {
    const recentValues = this.values.slice(-30);
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    let variance = 0;
    
    recentValues.forEach(value => {
      variance += Math.pow(value - mean, 2);
    });
    
    variance /= recentValues.length;
    
    // Convert to quality (less variance = higher stability)
    return Math.min(100, Math.max(0, 100 - (Math.sqrt(variance) * 50)));
  }

  private shouldOptimize(): boolean {
    if (this.qualityHistory.length < this.QUALITY_HISTORY_SIZE) {
      return false;
    }

    // Calculate quality trend
    const recentQuality = this.qualityHistory.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const oldQuality = this.qualityHistory.slice(0, 3).reduce((a, b) => a + b, 0) / 3;

    // Optimize if quality is decreasing or low
    return recentQuality < oldQuality || recentQuality < 70;
  }

  private generateOptimizationSuggestions(): SignalFeedback['optimizationSuggestions'] {
    const suggestions: NonNullable<SignalFeedback['optimizationSuggestions']> = {};

    // Analyze recent signal
    const recentValues = this.values.slice(-30);
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;

    // Suggest gain adjustments if amplitude is very low or high
    if (amplitude < 0.1) {
      suggestions.gainAdjustment = this.gain * 1.5;
    } else if (amplitude > 0.9) {
      suggestions.gainAdjustment = this.gain * 0.75;
    }

    // Suggest baseline correction if signal is off-center
    if (Math.abs(mean) > 0.1) {
      suggestions.baselineCorrection = -mean;
    }

    // Suggest filter adjustments based on noise
    const noiseLevel = this.calculateNoiseQuality();
    if (noiseLevel < 70) {
      suggestions.filters = {
        lowPass: this.config.filters?.lowPass ? this.config.filters.lowPass * 0.8 : 5,
        highPass: this.config.filters?.highPass ? this.config.filters.highPass * 1.2 : 0.5
      };
    }

    // Add correlation information for advanced bidirectional feedback
    if (this.channelCorrelations.size > 0) {
      suggestions.correlations = {};
      this.channelCorrelations.forEach((value, key) => {
        if (suggestions.correlations) {
          suggestions.correlations[key] = value;
        }
      });
    }

    return suggestions;
  }

  public setGain(gain: number): void {
    this.gain = gain;
  }

  public setBaseline(baseline: number): void {
    this.baseline = baseline;
  }

  public trimHistory(maxLength: number): void {
    if (this.values.length <= maxLength) return;

    const excess = this.values.length - maxLength;
    this.values = this.values.slice(excess);
    
    // Update metadata
    const newMetadata = new Map();
    this.metadata.forEach((value, key) => {
      if (typeof key === 'number' && key >= excess) {
        newMetadata.set(key - excess, value);
      } else if (typeof key === 'string') {
        newMetadata.set(key, value);
      }
    });
    this.metadata = newMetadata;
  }
}
