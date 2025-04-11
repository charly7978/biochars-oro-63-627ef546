
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

export class SignalChannel {
  private readonly name: string;
  private readonly bufferSize: number;
  private values: number[] = [];
  private metadata: Map<number, ChannelMetadata> = new Map();
  private customMetadata: Map<string, any> = new Map();
  
  constructor(name: string, bufferSize: number = 300) {
    this.name = name;
    this.bufferSize = bufferSize;
    console.log(`SignalChannel: Created new channel "${name}" with buffer size ${bufferSize}`);
  }
  
  /**
   * Add a new value to the channel with metadata
   */
  public addValue(value: number, meta?: Partial<ChannelMetadata>): void {
    // Add to values buffer
    this.values.push(value);
    if (this.values.length > this.bufferSize) {
      this.values.shift();
    }
    
    // Store metadata if provided
    if (meta) {
      const timestamp = meta.timestamp || Date.now();
      this.metadata.set(timestamp, {
        quality: meta.quality || 0,
        timestamp,
        ...(meta as ChannelMetadata)
      });
      
      // Clean up old metadata
      const oldestAllowedTime = timestamp - (this.bufferSize * 100); // Assume max 100ms per sample
      for (const [time] of this.metadata) {
        if (time < oldestAllowedTime) {
          this.metadata.delete(time);
        }
      }
    }
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
    console.log(`SignalChannel: Reset channel "${this.name}"`);
  }
}
