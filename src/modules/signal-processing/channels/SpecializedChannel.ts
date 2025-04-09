
/**
 * Base class for specialized signal processing channels
 */
import { OptimizedSignalChannel } from './OptimizedSignalChannel';

export abstract class SpecializedChannel implements OptimizedSignalChannel {
  public type: string;
  protected buffer: number[] = [];
  protected lastProcessingTime: number = 0;
  protected bufferSize: number = 120; // Default 2 minutes at 1Hz
  
  constructor(type: string) {
    this.type = type;
  }
  
  /**
   * Process an incoming signal value
   */
  public processSignal(value: number): void {
    // Add to buffer
    this.buffer.push(value);
    
    // Trim buffer if needed
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
    
    // Perform channel-specific processing
    this.processBuffer();
    
    // Update last processing time
    this.lastProcessingTime = Date.now();
  }
  
  /**
   * Process the current buffer (to be implemented by subclasses)
   */
  protected abstract processBuffer(): void;
  
  /**
   * Get processing results (to be implemented by subclasses)
   */
  public abstract getResults(): any;
  
  /**
   * Reset the channel
   */
  public reset(): void {
    this.buffer = [];
    this.lastProcessingTime = 0;
    this.resetChannel();
  }
  
  /**
   * Additional reset logic for subclasses
   */
  protected resetChannel(): void {
    // Default implementation does nothing
  }
}
