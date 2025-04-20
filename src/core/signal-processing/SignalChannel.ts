/**
 * Signal Channel - Represents a specialized processing channel for a specific vital sign
 */

export interface ChannelMetadata {
  quality: number;
  timestamp: number;
  timeDelta?: number;
  rawValue?: number;
  [key: string]: any; // Allow additional custom metadata
}

export interface FeedbackData {
  source: string;
  timestamp: number;
  calibrationFactor?: number;
  correctionValue?: number;
  confidenceScore?: number;
  noiseLevel?: number;
  qualityMetrics?: Record<string, number>;
}

export class SignalChannel {
  private readonly name: string;
  private readonly bufferSize: number;
  private values: number[] = [];
  private metadata: Map<number, ChannelMetadata> = new Map();
  private customMetadata: Map<string, any> = new Map();
  private feedbackBuffer: FeedbackData[] = [];
  private subscribers: Array<(value: number, metadata: ChannelMetadata) => void> = [];
  private optimizationEnabled: boolean = true;
  
  constructor(name: string, bufferSize: number = 300) {
    this.name = name;
    this.bufferSize = bufferSize;
    console.log(`SignalChannel: Created new channel "${name}" with buffer size ${bufferSize}`);
  }
  
  /**
   * Add a new value to the channel with metadata
   */
  public addValue(value: number, meta?: Partial<ChannelMetadata>): void {
    // Apply optimization from feedback if enabled
    const optimizedValue = this.optimizationEnabled ? this.applyOptimization(value) : value;
    
    // Add to values buffer
    this.values.push(optimizedValue);
    if (this.values.length > this.bufferSize) {
      this.values.shift();
    }
    
    // Store metadata if provided
    const finalMeta: ChannelMetadata = {
      quality: meta?.quality || 0,
      timestamp: meta?.timestamp || Date.now(),
      ...(meta as ChannelMetadata)
    };
    
    this.metadata.set(finalMeta.timestamp, finalMeta);
    
    // Clean up old metadata
    const oldestAllowedTime = finalMeta.timestamp - (this.bufferSize * 100); // Assume max 100ms per sample
    for (const [time] of this.metadata) {
      if (time < oldestAllowedTime) {
        this.metadata.delete(time);
      }
    }
    
    // Notify subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(optimizedValue, finalMeta);
      } catch (error) {
        console.error(`Error in channel "${this.name}" subscriber:`, error);
      }
    });
  }
  
  /**
   * Apply signal optimization based on feedback
   */
  private applyOptimization(value: number): number {
    if (this.feedbackBuffer.length === 0) {
      return value;
    }
    
    // Get most recent feedback within a reasonable time window (last 2 seconds)
    const currentTime = Date.now();
    const recentFeedback = this.feedbackBuffer
      .filter(fb => currentTime - fb.timestamp < 2000)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (recentFeedback.length === 0) {
      return value;
    }
    
    // Apply calibration factors from feedback
    let optimizedValue = value;
    let totalWeight = 0;
    
    recentFeedback.forEach((feedback, index) => {
      // More recent feedback has more weight
      const weight = Math.max(0, 1 - (index * 0.2));
      totalWeight += weight;
      
      // Apply calibration factor if available
      if (feedback.calibrationFactor) {
        optimizedValue += (value * feedback.calibrationFactor - value) * weight;
      }
      
      // Apply correction value if available
      if (feedback.correctionValue) {
        optimizedValue += feedback.correctionValue * weight;
      }
    });
    
    // Normalize by total weight
    if (totalWeight > 0) {
      optimizedValue = (optimizedValue + value * (1 - totalWeight)) / (2 - totalWeight);
    }
    
    return optimizedValue;
  }
  
  /**
   * Provide feedback from downstream processors for bidirectional optimization
   */
  public provideFeedback(feedback: FeedbackData): void {
    this.feedbackBuffer.push({
      ...feedback,
      timestamp: feedback.timestamp || Date.now()
    });
    
    // Keep feedback buffer limited to prevent memory issues
    if (this.feedbackBuffer.length > 20) {
      this.feedbackBuffer.shift();
    }
    
    // Log significant feedback for debugging
    if (feedback.calibrationFactor && Math.abs(feedback.calibrationFactor - 1) > 0.1) {
      console.log(`Channel "${this.name}": Significant calibration factor received:`, feedback);
    }
  }
  
  /**
   * Subscribe to new values in this channel
   */
  public subscribe(callback: (value: number, metadata: ChannelMetadata) => void): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Enable or disable optimization
   */
  public setOptimizationEnabled(enabled: boolean): void {
    this.optimizationEnabled = enabled;
    console.log(`Channel "${this.name}": Optimization ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Get all values in the channel
   */
  public getValues(): number[] {
    return [...this.values];
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
  public getMetadataByTime(timestamp: number): ChannelMetadata | undefined {
    return this.metadata.get(timestamp);
  }
  
  /**
   * Get the latest metadata
   */
  public getLastMetadata(): ChannelMetadata | undefined {
    if (this.metadata.size === 0) return undefined;
    
    // Find the most recent timestamp
    let latestTime = 0;
    let latestMeta: ChannelMetadata | undefined = undefined;
    
    for (const [time, meta] of this.metadata) {
      if (time > latestTime) {
        latestTime = time;
        latestMeta = meta;
      }
    }
    
    return latestMeta;
  }
  
  /**
   * Get feedback data
   */
  public getFeedbackData(): FeedbackData[] {
    return [...this.feedbackBuffer];
  }
  
  /**
   * Store custom metadata for the channel
   */
  public setMetadata(key: string, value: any): void {
    this.customMetadata.set(key, value);
  }
  
  /**
   * Get custom metadata
   */
  public getMetadata(key: string): any {
    return this.customMetadata.get(key);
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
    this.customMetadata.clear();
    this.feedbackBuffer = [];
    console.log(`SignalChannel: Reset channel "${this.name}"`);
  }
}
