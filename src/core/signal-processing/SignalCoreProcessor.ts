/**
 * Central Signal Processing Module
 * Handles core signal processing functionality with separate channels for different vital signs
 */
import { SignalChannel, FeedbackData } from './SignalChannel';
import { SignalFilter } from './filters/SignalFilter';

export interface SignalProcessingConfig {
  bufferSize: number;
  sampleRate: number;
  channels: string[];
}

// Standard vital sign channel names
export const VITAL_SIGN_CHANNELS = {
  HEARTBEAT: 'heartbeat',
  SPO2: 'spo2',
  BLOOD_PRESSURE: 'bloodPressure',
  ARRHYTHMIA: 'arrhythmia',
  GLUCOSE: 'glucose',
  LIPIDS: 'lipids',
  HEMOGLOBIN: 'hemoglobin',
  HYDRATION: 'hydration',
  RAW: 'raw',
  FILTERED: 'filtered'
};

export class SignalCoreProcessor {
  private channels: Map<string, SignalChannel> = new Map();
  private rawBuffer: number[] = [];
  private filteredBuffer: number[] = [];
  private readonly bufferSize: number;
  private readonly filter: SignalFilter;
  private lastProcessTime: number = 0;
  private config: SignalProcessingConfig;
  
  constructor(config: SignalProcessingConfig) {
    this.config = config;
    this.bufferSize = config.bufferSize || 300;
    this.filter = new SignalFilter();
    
    // Initialize standard channels
    Object.values(VITAL_SIGN_CHANNELS).forEach(channelName => {
      this.createChannel(channelName);
    });
    
    // Initialize additional channels if provided
    if (config.channels) {
      config.channels.forEach(channelName => {
        if (!this.channels.has(channelName)) {
          this.createChannel(channelName);
        }
      });
    }
    
    // Set up inter-channel subscriptions
    this.setupChannelSubscriptions();
    
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
   * Setup inter-channel subscriptions for data flow
   */
  private setupChannelSubscriptions(): void {
    // Set up raw to filtered subscription
    const rawChannel = this.getChannel(VITAL_SIGN_CHANNELS.RAW);
    const filteredChannel = this.getChannel(VITAL_SIGN_CHANNELS.FILTERED);
    
    if (rawChannel && filteredChannel) {
      rawChannel.subscribe((value, metadata) => {
        const filtered = this.applyFilters(value);
        filteredChannel.addValue(filtered, {
          ...metadata,
          rawValue: value
        });
      });
    }
    
    // Filtered channel feeds into all vital sign channels
    if (filteredChannel) {
      filteredChannel.subscribe((value, metadata) => {
        // Feed into heartbeat channel
        const heartbeatChannel = this.getChannel(VITAL_SIGN_CHANNELS.HEARTBEAT);
        if (heartbeatChannel) {
          heartbeatChannel.addValue(value, metadata);
        }
        
        // Feed into spo2 channel
        const spo2Channel = this.getChannel(VITAL_SIGN_CHANNELS.SPO2);
        if (spo2Channel) {
          spo2Channel.addValue(value, metadata);
        }
        
        // Feed into other vital sign channels
        [
          VITAL_SIGN_CHANNELS.BLOOD_PRESSURE,
          VITAL_SIGN_CHANNELS.ARRHYTHMIA,
          VITAL_SIGN_CHANNELS.GLUCOSE,
          VITAL_SIGN_CHANNELS.LIPIDS,
          VITAL_SIGN_CHANNELS.HEMOGLOBIN,
          VITAL_SIGN_CHANNELS.HYDRATION
        ].forEach(channelName => {
          const channel = this.getChannel(channelName);
          if (channel) {
            channel.addValue(value, metadata);
          }
        });
      });
    }
  }
  
  /**
   * Process a raw PPG signal
   * Core method that applies filtering and distributes to channels
   */
  public processSignal(value: number): Map<string, SignalChannel> {
    const currentTime = Date.now();
    const timeDelta = this.lastProcessTime ? currentTime - this.lastProcessTime : 0;
    this.lastProcessTime = currentTime;
    
    // Add to raw buffer and channel
    this.rawBuffer.push(value);
    if (this.rawBuffer.length > this.bufferSize) {
      this.rawBuffer.shift();
    }
    
    // Add to raw channel
    const rawChannel = this.getChannel(VITAL_SIGN_CHANNELS.RAW);
    if (rawChannel) {
      rawChannel.addValue(value, {
        quality: 100, // Raw signal always has perfect "quality" since it's what we measure
        timestamp: currentTime,
        timeDelta
      });
    }
    
    // Apply common filtering for backward compatibility
    const filtered = this.applyFilters(value);
    
    // Add to filtered buffer for backward compatibility
    this.filteredBuffer.push(filtered);
    if (this.filteredBuffer.length > this.bufferSize) {
      this.filteredBuffer.shift();
    }
    
    // Calculate signal quality
    const quality = this.calculateSignalQuality(filtered);
    
    // Specialized processing for the heartbeat channel
    const heartbeatChannel = this.channels.get(VITAL_SIGN_CHANNELS.HEARTBEAT);
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
            
            // Provide feedback to the filtered channel for optimization
            const filteredChannel = this.getChannel(VITAL_SIGN_CHANNELS.FILTERED);
            if (filteredChannel) {
              filteredChannel.provideFeedback({
                source: VITAL_SIGN_CHANNELS.HEARTBEAT,
                timestamp: currentTime,
                calibrationFactor: 1.0, // Default, no adjustment
                confidenceScore: 0.8,
                qualityMetrics: {
                  heartRate
                }
              });
            }
          }
        }
      }
    }
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
   * Provide feedback from a vital sign processor to optimize the signal chain
   */
  public provideFeedback(channelName: string, feedback: FeedbackData): void {
    const channel = this.getChannel(channelName);
    if (channel) {
      channel.provideFeedback(feedback);
      console.log(`Feedback provided to channel "${channelName}"`, feedback);
    } else {
      console.warn(`Attempted to provide feedback to non-existent channel "${channelName}"`);
    }
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
