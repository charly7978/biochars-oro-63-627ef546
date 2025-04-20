/**
 * VitalSignIntegrator
 * 
 * Connects vital sign processors with the signal processing core through
 * dedicated channels with bidirectional feedback for continuous optimization.
 */

import { SignalCoreProcessor, VITAL_SIGN_CHANNELS } from '../signal-processing/SignalCoreProcessor';
import { FeedbackData } from '../signal-processing/SignalChannel';
import { CalibrationIntegrator } from '../calibration/CalibrationIntegrator';

export interface ProcessorMetrics {
  confidence: number;
  quality: number;
  timestamp: number;
  value: number | number[];
  [key: string]: any;
}

export class VitalSignIntegrator {
  private static instance: VitalSignIntegrator;
  private signalProcessor: SignalCoreProcessor;
  private calibrationIntegrator: CalibrationIntegrator;
  private processorMetrics: Map<string, ProcessorMetrics> = new Map();
  private feedbackInterval: number | null = null;
  
  private constructor(signalProcessor: SignalCoreProcessor) {
    this.signalProcessor = signalProcessor;
    this.calibrationIntegrator = CalibrationIntegrator.getInstance();
    
    // Setup periodic feedback loop
    this.setupFeedbackLoop();
    
    console.log('VitalSignIntegrator: Initialized with bidirectional channel optimization');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(signalProcessor?: SignalCoreProcessor): VitalSignIntegrator {
    if (!VitalSignIntegrator.instance && signalProcessor) {
      VitalSignIntegrator.instance = new VitalSignIntegrator(signalProcessor);
    } else if (!VitalSignIntegrator.instance) {
      throw new Error('VitalSignIntegrator not initialized. Provide SignalCoreProcessor on first call.');
    }
    
    return VitalSignIntegrator.instance;
  }
  
  /**
   * Setup bidirectional feedback loop for continuous optimization
   */
  private setupFeedbackLoop(): void {
    // Clear any existing interval
    if (this.feedbackInterval !== null) {
      window.clearInterval(this.feedbackInterval);
    }
    
    // Create new interval for feedback synchronization
    this.feedbackInterval = window.setInterval(() => {
      this.synchronizeFeedback();
    }, 500); // Update every 500ms (2Hz)
  }
  
  /**
   * Synchronize feedback between all processors and channels
   */
  private synchronizeFeedback(): void {
    const currentTime = Date.now();
    
    // Process feedback from each vital sign processor to signal core
    this.processorMetrics.forEach((metrics, processorName) => {
      // Only process recent metrics (within last 2 seconds)
      if (currentTime - metrics.timestamp < 2000) {
        // Map processor name to channel name
        const channelName = this.mapProcessorToChannel(processorName);
        if (!channelName) return;
        
        // Create feedback data
        const feedback: FeedbackData = {
          source: processorName,
          timestamp: metrics.timestamp,
          confidenceScore: metrics.confidence,
          qualityMetrics: {
            confidence: metrics.confidence,
            quality: metrics.quality
          }
        };
        
        // Add calibration factor if value differs significantly from channel value
        const channel = this.signalProcessor.getChannel(channelName);
        if (channel) {
          const channelValue = channel.getLastValue();
          if (channelValue !== null && typeof metrics.value === 'number') {
            // Calculate adaptive calibration factor
            const idealCalibrationFactor = channelValue !== 0 ? 
              metrics.value / channelValue : 1.0;
            
            // Limit calibration factor to reasonable range (0.5-2.0)
            const calibrationFactor = Math.max(0.5, Math.min(2.0, idealCalibrationFactor));
            
            // Only apply significant calibration
            if (Math.abs(calibrationFactor - 1.0) > 0.05) {
              feedback.calibrationFactor = calibrationFactor;
            }
          }
        }
        
        // Provide feedback to the channel
        this.signalProcessor.provideFeedback(channelName, feedback);
      }
    });
    
    // Process feedback from calibration system
    const calibrationState = this.calibrationIntegrator.getCalibrationState();
    if (calibrationState && typeof calibrationState !== 'void' && calibrationState.phase === 'active') { 
      Object.values(VITAL_SIGN_CHANNELS).forEach(channelName => {
        const calibrationFactor = this.getCalibrationFactorForChannel(channelName);
        if (calibrationFactor !== 1.0) {
          this.signalProcessor.provideFeedback(channelName, {
            source: 'calibration',
            timestamp: currentTime,
            calibrationFactor,
            confidenceScore: 0.9
          });
        }
      });
    }
  }
  
  /**
   * Get calibration factor for a specific channel from calibration system
   */
  private getCalibrationFactorForChannel(channelName: string): number {
    // Default is no calibration (factor = 1.0)
    let factor = 1.0;
    
    // Map channel to appropriate calibration factor
    switch (channelName) {
      case VITAL_SIGN_CHANNELS.HEARTBEAT:
        factor = 1.0; // Heart rate calibration factor
        break;
      case VITAL_SIGN_CHANNELS.SPO2:
        factor = 1.0; // SpO2 calibration factor
        break;
      case VITAL_SIGN_CHANNELS.BLOOD_PRESSURE:
        factor = 1.0; // BP calibration factor
        break;
      // Add other channels as needed
    }
    
    return factor;
  }
  
  /**
   * Map processor name to channel name
   */
  private mapProcessorToChannel(processorName: string): string | undefined {
    const mapping: Record<string, string> = {
      'heartRate': VITAL_SIGN_CHANNELS.HEARTBEAT,
      'heartBeat': VITAL_SIGN_CHANNELS.HEARTBEAT,
      'spo2': VITAL_SIGN_CHANNELS.SPO2,
      'bloodPressure': VITAL_SIGN_CHANNELS.BLOOD_PRESSURE,
      'glucose': VITAL_SIGN_CHANNELS.GLUCOSE,
      'lipids': VITAL_SIGN_CHANNELS.LIPIDS,
      'hemoglobin': VITAL_SIGN_CHANNELS.HEMOGLOBIN,
      'hydration': VITAL_SIGN_CHANNELS.HYDRATION,
      'arrhythmia': VITAL_SIGN_CHANNELS.ARRHYTHMIA
    };
    
    return mapping[processorName];
  }
  
  /**
   * Register metrics from a vital sign processor for feedback
   */
  public registerProcessorMetrics(processorName: string, metrics: ProcessorMetrics): void {
    this.processorMetrics.set(processorName, {
      ...metrics,
      timestamp: metrics.timestamp || Date.now()
    });
  }
  
  /**
   * Get dedicated channel for a vital sign processor
   */
  public getChannelForProcessor(processorName: string): string | undefined {
    return this.mapProcessorToChannel(processorName);
  }
  
  /**
   * Get data from a vital sign channel
   */
  public getVitalSignData(vitalSign: string): {
    values: number[];
    latestValue: number | null;
    metadata: any;
  } {
    const channelName = this.mapProcessorToChannel(vitalSign) || vitalSign;
    const channel = this.signalProcessor.getChannel(channelName);
    
    if (!channel) {
      return {
        values: [],
        latestValue: null,
        metadata: {}
      };
    }
    
    return {
      values: channel.getValues(),
      latestValue: channel.getLastValue(),
      metadata: {
        ...channel.getLastMetadata(),
        customMetadata: Array.from(Object.entries(channel)).reduce((acc, [key, value]) => {
          acc[key] = channel.getMetadata(key);
          return acc;
        }, {} as Record<string, any>)
      }
    };
  }
  
  /**
   * Register for updates from a vital sign channel
   */
  public subscribeToVitalSign(
    vitalSign: string, 
    callback: (value: number, metadata: any) => void
  ): () => void {
    const channelName = this.mapProcessorToChannel(vitalSign) || vitalSign;
    const channel = this.signalProcessor.getChannel(channelName);
    
    if (!channel) {
      console.warn(`Cannot subscribe to non-existent channel: ${channelName}`);
      return () => {}; // No-op unsubscribe
    }
    
    return channel.subscribe(callback);
  }
  
  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.feedbackInterval !== null) {
      window.clearInterval(this.feedbackInterval);
      this.feedbackInterval = null;
    }
  }
}
