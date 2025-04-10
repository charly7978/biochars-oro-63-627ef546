
/**
 * Central Signal Processing Module
 * Handles core signal processing functionality with separate channels for different vital signs
 */
import { SignalChannel } from './SignalChannel';
import { SignalFilter } from './filters/SignalFilter';

export interface SignalProcessingConfig {
  bufferSize: number;
  sampleRate: number;
  channels: string[];
}

export class SignalCoreProcessor {
  private channels: Map<string, SignalChannel> = new Map();
  private rawBuffer: number[] = [];
  private filteredBuffer: number[] = [];
  private readonly bufferSize: number;
  private readonly filter: SignalFilter;
  private lastProcessTime: number = 0;
  
  constructor(config: SignalProcessingConfig) {
    this.bufferSize = config.bufferSize || 300;
    this.filter = new SignalFilter();
    
    // Initialize channels
    if (config.channels) {
      config.channels.forEach(channelName => {
        this.createChannel(channelName);
      });
    }
    
    // Create default channels if none provided
    if (!config.channels || config.channels.length === 0) {
      this.createChannel('heartbeat');
      this.createChannel('spo2');
      this.createChannel('arrhythmia');
      this.createChannel('bloodPressure');
    }
    
    console.log("SignalCoreProcessor: Initialized with channels:", 
      Array.from(this.channels.keys()).join(', '));
  }
  
  /**
   * Create a new signal processing channel
   */
  public createChannel(channelName: string): SignalChannel {
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }
    
    const channel = new SignalChannel(channelName, this.bufferSize);
    this.channels.set(channelName, channel);
    return channel;
  }
  
  /**
   * Process a raw PPG signal
   * Core method that applies filtering and distributes to channels
   */
  public processSignal(value: number): Map<string, SignalChannel> {
    const currentTime = Date.now();
    const timeDelta = this.lastProcessTime ? currentTime - this.lastProcessTime : 0;
    this.lastProcessTime = currentTime;
    
    // Add to raw buffer
    this.rawBuffer.push(value);
    if (this.rawBuffer.length > this.bufferSize) {
      this.rawBuffer.shift();
    }
    
    // Apply common filtering
    const filtered = this.applyFilters(value);
    
    // Add to filtered buffer
    this.filteredBuffer.push(filtered);
    if (this.filteredBuffer.length > this.bufferSize) {
      this.filteredBuffer.shift();
    }
    
    // Calculate signal quality
    const quality = this.calculateSignalQuality(filtered);
    
    // Update all channels
    this.channels.forEach(channel => {
      channel.addValue(filtered, {
        quality,
        timestamp: currentTime,
        timeDelta,
        rawValue: value
      });
    });
    
    return this.channels;
  }
  
  /**
   * Apply multiple filtering techniques to the signal
   */
  private applyFilters(value: number): number {
    return this.filter.applyFilters(value, this.rawBuffer);
  }
  
  /**
   * Calculate signal quality from 0-100
   */
  private calculateSignalQuality(value: number): number {
    if (this.filteredBuffer.length < 10) return 0;
    
    // Basic quality calculation
    const recentValues = this.filteredBuffer.slice(-10);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;
    
    // Calculate noise level
    let noiseLevel = 0;
    for (let i = 1; i < recentValues.length; i++) {
      noiseLevel += Math.abs(recentValues[i] - recentValues[i-1]);
    }
    noiseLevel /= (recentValues.length - 1);
    
    // Signal-to-noise ratio based quality
    const signalToNoise = range / (noiseLevel || 0.001);
    
    // Convert to 0-100 scale
    return Math.min(100, Math.max(0, signalToNoise * 20));
  }
  
  /**
   * Get a specific channel by name
   */
  public getChannel(channelName: string): SignalChannel | undefined {
    return this.channels.get(channelName);
  }
  
  /**
   * Get all raw buffer values
   */
  public getRawBuffer(): number[] {
    return [...this.rawBuffer];
  }
  
  /**
   * Get all filtered buffer values
   */
  public getFilteredBuffer(): number[] {
    return [...this.filteredBuffer];
  }
  
  /**
   * Reset all buffers and channels
   */
  public reset(): void {
    this.rawBuffer = [];
    this.filteredBuffer = [];
    this.lastProcessTime = 0;
    
    this.channels.forEach(channel => {
      channel.reset();
    });
    
    console.log("SignalCoreProcessor: Reset complete");
  }
}
