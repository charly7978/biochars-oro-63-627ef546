
/**
 * Base class for all specialized vital sign processors
 * Provides common functionality for all processors
 */
import { VitalSignType, ChannelFeedback } from '../../../types/signal';
import { v4 as uuidv4 } from 'uuid';

/**
 * Abstract base class for specialized vital sign processors
 */
export abstract class BaseVitalSignProcessor<T> {
  protected readonly type: VitalSignType;
  protected readonly id: string;
  protected confidence: number = 0;
  protected lastProcessedValue: number = 0;
  protected buffer: number[] = [];
  protected readonly MAX_BUFFER_SIZE: number = 100;
  protected lastFeedback: ChannelFeedback | null = null;
  protected isInitialized: boolean = false;
  
  /**
   * Constructor
   * @param type Type of vital sign this processor handles
   */
  constructor(type: VitalSignType) {
    this.type = type;
    this.id = `${type}-processor-${uuidv4().substring(0, 8)}`;
  }
  
  /**
   * Initialize the processor
   */
  public initialize(): void {
    this.buffer = [];
    this.confidence = 0;
    this.lastProcessedValue = 0;
    this.lastFeedback = null;
    this.isInitialized = true;
    
    console.log(`${this.typeToString()} Processor: Initialized`);
  }
  
  /**
   * Reset the processor state
   */
  public reset(): void {
    this.buffer = [];
    this.confidence = 0;
    this.lastProcessedValue = 0;
    this.lastFeedback = null;
    
    console.log(`${this.typeToString()} Processor: Reset`);
  }
  
  /**
   * Get the processor's confidence in its measurements (0-1)
   */
  public getConfidence(): number {
    return this.confidence;
  }
  
  /**
   * Process a value from the optimized channel
   * @param value Channel-optimized value
   * @returns Processed result
   */
  public processValue(value: number): T {
    this.lastProcessedValue = value;
    
    // Add to buffer
    this.buffer.push(value);
    if (this.buffer.length > this.MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
    
    // Calculate confidence
    this.updateConfidence();
    
    // Process the value
    return this.processValueImpl(value);
  }
  
  /**
   * Get feedback for the channel to optimize for this processor
   */
  public getFeedback(): ChannelFeedback | null {
    // Base implementation for feedback
    // Subclasses can override for specialized feedback
    
    // Skip feedback if we don't have enough data
    if (this.buffer.length < 10) {
      return null;
    }
    
    // Create basic feedback
    const feedback: ChannelFeedback = {
      channelId: this.id,
      signalQuality: this.confidence,
      suggestedAdjustments: {},
      timestamp: Date.now(),
      success: this.confidence > 0.3
    };
    
    // Suggest amplification adjustment based on recent values
    const recent = this.buffer.slice(-10);
    const avg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const maxAbs = Math.max(...recent.map(val => Math.abs(val)));
    
    // If values are too small, suggest higher amplification
    if (maxAbs < 0.1 && this.confidence < 0.5) {
      feedback.suggestedAdjustments.amplificationFactor = 1.2;
    }
    
    // If values are too large, suggest lower amplification
    if (maxAbs > 5 && this.confidence < 0.5) {
      feedback.suggestedAdjustments.amplificationFactor = 0.9;
    }
    
    // Store this feedback
    this.lastFeedback = feedback;
    
    return feedback;
  }
  
  /**
   * Update confidence based on signal characteristics
   * Subclasses should override for specific confidence calculation
   */
  protected updateConfidence(): void {
    if (this.buffer.length < 5) {
      this.confidence = 0;
      return;
    }
    
    // Base confidence calculation (simple example)
    const recent = this.buffer.slice(-10);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    
    // Calculate signal-to-noise ratio (simple approximation)
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
    const snr = mean !== 0 ? Math.abs(mean / Math.sqrt(variance)) : 0;
    
    // Base confidence on SNR
    this.confidence = Math.min(1, snr / 10);
  }
  
  /**
   * Implementation of value processing
   * Must be implemented by subclasses
   */
  protected abstract processValueImpl(value: number): T;
  
  /**
   * Convert type to readable string
   */
  protected typeToString(): string {
    return this.type.charAt(0).toUpperCase() + this.type.slice(1);
  }
}
