
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
    
    console.log(`SignalCoreProcessor: Processing signal value: ${value}`);
    
    // Add to raw buffer
    this.rawBuffer.push(value);
    if (this.rawBuffer.length > this.bufferSize) {
      this.rawBuffer.shift();
    }
    
    // Apply common filtering - more lenient to accommodate lower quality signals
    const filtered = this.applyFilters(value);
    
    // Add to filtered buffer
    this.filteredBuffer.push(filtered);
    if (this.filteredBuffer.length > this.bufferSize) {
      this.filteredBuffer.shift();
    }
    
    // Calculate signal quality with lower threshold
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
    
    // Specialized processing for the heartbeat channel
    const heartbeatChannel = this.channels.get('heartbeat');
    if (heartbeatChannel) {
      // Perform peak detection on the heartbeat channel with more sensitive settings
      this.processHeartbeatChannel(heartbeatChannel, filtered, currentTime);
    }
    
    return this.channels;
  }
  
  /**
   * Process heartbeat channel - detect peaks and calculate heart rate
   * Improved with more sensitive peak detection
   */
  private processHeartbeatChannel(channel: SignalChannel, value: number, currentTime: number): void {
    const values = channel.getValues();
    if (values.length < 5) return; // Reduced from 10 for faster initial detection
    
    // More sensitive peak detection
    const MIN_PEAK_DISTANCE_MS = 300; // Minimum 300ms between peaks (200 BPM max)
    const lastPeakTime = channel.getMetadata('lastPeakTime') as number | null;
    
    // Store last 8 values for peak detection
    const recent = values.slice(-8);
    const current = recent[recent.length - 1];
    const prev1 = recent[recent.length - 2] || 0;
    const prev2 = recent[recent.length - 3] || 0;
    
    // More sensitive peak detection criteria
    // Check if this is a peak - reduced threshold for detection
    const isPeak = current > prev1 * 1.05 && 
                   current > prev2 * 1.05 && 
                   current > 0.05; // Reduced minimum peak amplitude
    
    // Check if enough time passed since last peak
    const timeSinceLastPeak = lastPeakTime ? currentTime - lastPeakTime : 0;
    const isValidPeak = isPeak && (!lastPeakTime || timeSinceLastPeak > MIN_PEAK_DISTANCE_MS);
    
    if (isValidPeak) {
      console.log("SignalCoreProcessor: Peak detected");
      
      // Store peak time
      channel.setMetadata('lastPeakTime', currentTime);
      
      // Calculate RR interval
      if (lastPeakTime) {
        const rrInterval = currentTime - lastPeakTime;
        
        // Store RR intervals (last 8)
        const rrIntervals = channel.getMetadata('rrIntervals') as number[] || [];
        rrIntervals.push(rrInterval);
        
        // Keep only the last 8 intervals
        if (rrIntervals.length > 8) {
          rrIntervals.shift();
        }
        
        channel.setMetadata('rrIntervals', rrIntervals);
        
        // Calculate heart rate from RR intervals
        if (rrIntervals.length >= 2) { // Reduced from 3 for faster initial detection
          // Use the median of the last intervals for stability
          const recentRR = [...rrIntervals].sort((a, b) => a - b);
          const medianRR = recentRR[Math.floor(recentRR.length / 2)];
          
          // Convert to BPM
          const heartRate = Math.round(60000 / medianRR);
          
          // Store heart rate with wider acceptable range
          if (heartRate >= 30 && heartRate <= 220) {
            channel.setMetadata('heartRate', heartRate);
          }
        }
      }
    }
  }
  
  /**
   * Apply multiple filtering techniques to the signal
   * More lenient to allow for lower quality signals
   */
  private applyFilters(value: number): number {
    return this.filter.applyFilters(value, this.rawBuffer);
  }
  
  /**
   * Calculate signal quality from 0-100
   * Modified to be more generous with low quality signals
   */
  private calculateSignalQuality(value: number): number {
    if (this.filteredBuffer.length < 10) return 30; // Start with minimum quality
    
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
    
    // Signal-to-noise ratio based quality - more lenient
    const signalToNoise = range / (noiseLevel || 0.001);
    
    // Convert to 0-100 scale with minimum level
    return Math.min(100, Math.max(30, signalToNoise * 20));
  }
  
  /**
   * Get a specific channel by name
   */
  public getChannel(channelName: string): SignalChannel | undefined {
    return this.channels.get(channelName);
  }
  
  /**
   * Get all channels
   */
  public getAllChannels(): Map<string, SignalChannel> {
    return new Map(this.channels);
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
