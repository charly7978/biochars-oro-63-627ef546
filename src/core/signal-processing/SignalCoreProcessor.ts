/**
 * Central Signal Processing Module
 * Handles core signal processing functionality with separate channels for different vital signs
 */
import { SignalChannel } from './SignalChannel';
// Remove SignalFilter import
// import { SignalFilter } from './filters/SignalFilter';
// Import utility functions instead
import {
  applyMedianFilter,
  applyEMAFilter,
  applySMAFilter,
  evaluateSignalQuality,
  SIGNAL_CONSTANTS
} from '@/utils/vitalSignsUtils';

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
  // Remove filter instance
  // private readonly filter: SignalFilter;
  // Add state for EMA filter
  private lastEMA: number | null = null;
  private lastProcessTime: number = 0;
  
  constructor(config: SignalProcessingConfig) {
    this.bufferSize = config.bufferSize || SIGNAL_CONSTANTS.DEFAULT_BUFFER_SIZE; // Use constant
    // Remove filter initialization
    // this.filter = new SignalFilter();
    
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
    
    // Apply common filtering using utility functions
    const filtered = this.applyFilters(value);
    
    // Add to filtered buffer
    this.filteredBuffer.push(filtered);
    if (this.filteredBuffer.length > this.bufferSize) {
      this.filteredBuffer.shift();
    }
    
    // Calculate signal quality using utility function
    const quality = evaluateSignalQuality(this.filteredBuffer, SIGNAL_CONSTANTS.MIN_AMPLITUDE);
    
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
      // Perform peak detection on the heartbeat channel
      this.processHeartbeatChannel(heartbeatChannel, filtered, currentTime);
    }
    
    return this.channels;
  }
  
  /**
   * Process heartbeat channel - detect peaks and calculate heart rate
   */
  private processHeartbeatChannel(channel: SignalChannel, value: number, currentTime: number): void {
    const values = channel.getValues();
    if (values.length < 10) return;
    
    // Simple peak detection
    const MIN_PEAK_DISTANCE_MS = 300; // Minimum 300ms between peaks (200 BPM max)
    const lastPeakTime = channel.getMetadata('lastPeakTime') as number | null;
    
    // Store last 8 values for peak detection
    const recent = values.slice(-8);
    const current = recent[recent.length - 1];
    const prev1 = recent[recent.length - 2] || 0;
    const prev2 = recent[recent.length - 3] || 0;
    
    // Check if this is a peak
    const isPeak = current > prev1 && 
                   current > prev2 && 
                   current > 0.1; // Minimum peak amplitude
    
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
        if (rrIntervals.length >= 3) {
          // Use the median of the last 3 intervals for stability
          const recentRR = [...rrIntervals].slice(-3).sort((a, b) => a - b);
          const medianRR = recentRR[Math.floor(recentRR.length / 2)];
          
          // Convert to BPM
          const heartRate = Math.round(60000 / medianRR);
          
          // Store heart rate
          if (heartRate >= 40 && heartRate <= 200) {
            channel.setMetadata('heartRate', heartRate);
          }
        }
      }
    }
  }
  
  /**
   * Apply multiple filtering techniques to the signal using utility functions
   */
  private applyFilters(value: number): number {
    // Apply median filter first
    const medianFiltered = applyMedianFilter(value, this.rawBuffer, 5); // windowSize = 5

    // Apply EMA filter
    const { nextEMA, filteredValue: emaFiltered } = applyEMAFilter(medianFiltered, this.lastEMA, 0.3); // alpha = 0.3
    this.lastEMA = nextEMA; // Update EMA state

    // Apply SMA filter
    const { filteredValue: smaFiltered } = applySMAFilter(emaFiltered, this.filteredBuffer, SIGNAL_CONSTANTS.SMA_WINDOW); // Use constant

    return smaFiltered;
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
    // Reset EMA state
    this.lastEMA = null;
    
    this.channels.forEach(channel => {
      channel.reset();
    });
    
    console.log("SignalCoreProcessor: Reset complete");
  }
}
