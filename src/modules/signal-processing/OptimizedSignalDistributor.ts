
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Optimized Signal Distributor
 * Routes signals to specialized channels and collects results
 */

import { 
  OptimizedSignalChannel, 
  VitalSignType, 
  ChannelFeedback,
  SignalDistributorConfig
} from '../../types/signal';

import { GlucoseChannel } from './channels/GlucoseChannel';
import { LipidsChannel } from './channels/LipidsChannel';
import { BloodPressureChannel } from './channels/BloodPressureChannel';
import { SpO2Channel } from './channels/SpO2Channel';
import { CardiacChannel } from './channels/CardiacChannel';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: SignalDistributorConfig = {
  enableFeedback: true,
  adaptChannels: true,
  optimizationInterval: 5000,
  channels: {
    [VitalSignType.GLUCOSE]: {
      initialAmplification: 1.2,
      initialFilterStrength: 0.3,
      frequencyBandMin: 0.1,
      frequencyBandMax: 1.0
    },
    [VitalSignType.LIPIDS]: {
      initialAmplification: 1.4,
      initialFilterStrength: 0.4,
      frequencyBandMin: 0.1,
      frequencyBandMax: 0.8
    },
    [VitalSignType.BLOOD_PRESSURE]: {
      initialAmplification: 1.5,
      initialFilterStrength: 0.5,
      frequencyBandMin: 0.5,
      frequencyBandMax: 4.0
    },
    [VitalSignType.SPO2]: {
      initialAmplification: 1.1,
      initialFilterStrength: 0.6,
      frequencyBandMin: 0.5,
      frequencyBandMax: 3.5
    },
    [VitalSignType.CARDIAC]: {
      initialAmplification: 1.3,
      initialFilterStrength: 0.7,
      frequencyBandMin: 0.8,
      frequencyBandMax: 5.0
    }
  }
};

/**
 * Optimized Signal Distributor
 * Routes PPG signal to specialized channels for different vital signs
 */
export class OptimizedSignalDistributor {
  private config: SignalDistributorConfig;
  private channels: Map<VitalSignType, OptimizedSignalChannel> = new Map();
  private lastOptimizationTime: number = 0;
  
  /**
   * Constructor
   */
  constructor(config: Partial<SignalDistributorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeChannels();
  }
  
  /**
   * Initialize all channels
   */
  private initializeChannels(): void {
    // Create channels
    const glucoseChannel = new GlucoseChannel();
    const lipidsChannel = new LipidsChannel();
    const bloodPressureChannel = new BloodPressureChannel();
    const spo2Channel = new SpO2Channel();
    const cardiacChannel = new CardiacChannel();
    
    // Add to map
    this.addChannel(glucoseChannel);
    this.addChannel(lipidsChannel);
    this.addChannel(bloodPressureChannel);
    this.addChannel(spo2Channel);
    this.addChannel(cardiacChannel);
  }
  
  /**
   * Add a channel to the distributor
   */
  private addChannel(channel: OptimizedSignalChannel): void {
    this.channels.set(channel.type, channel);
  }
  
  /**
   * Process a PPG value through all channels
   */
  public processValue(value: number): Map<VitalSignType, number> {
    const results = new Map<VitalSignType, number>();
    
    // Process through each channel
    this.channels.forEach((channel, type) => {
      const processedValue = channel.processValue(value);
      results.set(type, processedValue);
    });
    
    // Check if optimization is due
    const currentTime = Date.now();
    if (this.config.adaptChannels && 
        currentTime - this.lastOptimizationTime > this.config.optimizationInterval) {
      this.optimizeChannels();
      this.lastOptimizationTime = currentTime;
    }
    
    return results;
  }
  
  /**
   * Apply feedback to channels
   */
  public applyFeedback(feedback: ChannelFeedback): void {
    if (!this.config.enableFeedback) return;
    
    const channel = this.findChannelById(feedback.channelId);
    if (channel) {
      channel.applyFeedback(feedback);
    }
  }
  
  /**
   * Find a channel by its ID
   */
  private findChannelById(channelId: string): OptimizedSignalChannel | undefined {
    for (const channel of this.channels.values()) {
      if (channel.getId() === channelId) {
        return channel;
      }
    }
    return undefined;
  }
  
  /**
   * Optimize channels based on their quality scores
   */
  private optimizeChannels(): void {
    // This would contain adaptive algorithms to improve channel processing
    // based on feedback and quality scores
    console.log("OptimizedSignalDistributor: Optimizing channels");
  }
  
  /**
   * Get quality scores for all channels
   */
  public getQualityScores(): Map<VitalSignType, number> {
    const scores = new Map<VitalSignType, number>();
    
    this.channels.forEach((channel, type) => {
      scores.set(type, channel.getQuality());
    });
    
    return scores;
  }
  
  /**
   * Reset all channels
   */
  public reset(): void {
    this.channels.forEach(channel => channel.reset());
    this.lastOptimizationTime = 0;
  }
}
