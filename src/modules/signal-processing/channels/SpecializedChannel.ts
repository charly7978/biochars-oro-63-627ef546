
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Base class for all specialized signal channels
 */

import { VitalSignType, ChannelFeedback, OptimizedSignalChannel } from '../../../types/signal';

/**
 * Abstract base class for all specialized signal channels
 */
export abstract class SpecializedChannel implements OptimizedSignalChannel {
  // The type of vital sign this channel processes
  public readonly type: VitalSignType;
  
  // Channel ID
  public readonly id: string;
  
  // Channel quality (0-1)
  protected confidence: number = 0;
  
  // Signal buffer
  protected buffer: number[] = [];
  protected readonly MAX_BUFFER_SIZE = 30;
  
  /**
   * Constructor
   */
  constructor(type: VitalSignType) {
    this.type = type;
    this.id = `channel_${this.type}`;
  }
  
  /**
   * Process a value for this specific channel
   */
  public processValue(value: number): number {
    // Store value in buffer
    this.buffer.push(value);
    if (this.buffer.length > this.MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
    
    // Process value (implemented by subclasses)
    return this.processValueImpl(value);
  }
  
  /**
   * Implementation of value processing (must be implemented by subclasses)
   */
  protected abstract processValueImpl(value: number): number;
  
  /**
   * Apply feedback from algorithm
   */
  public applyFeedback(feedback: ChannelFeedback): void {
    // Update quality based on feedback
    if (feedback.channelId === this.getId()) {
      this.confidence = feedback.signalQuality;
    }
  }
  
  /**
   * Get channel quality
   */
  public getQuality(): number {
    return this.confidence;
  }
  
  /**
   * Reset channel state
   */
  public reset(): void {
    this.buffer = [];
    this.confidence = 0;
  }
  
  /**
   * Get channel ID
   */
  public getId(): string {
    return this.id;
  }
}
