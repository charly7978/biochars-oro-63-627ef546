
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Signal distributor that optimizes signal processing across specialized channels
 */

import { 
  OptimizedSignalChannel, 
  SignalDistributorConfig,
  SignalProcessingResult,
  SignalDiagnosticInfo,
  BloodPressureResult,
  CardiacResult
} from './interfaces';

import { VitalSignType } from './channels/SpecializedChannel';
import { GlucoseChannel } from './channels/GlucoseChannel';
import { LipidsChannel } from './channels/LipidsChannel';
import { BloodPressureChannel } from './channels/BloodPressureChannel';
import { SpO2Channel } from './channels/SpO2Channel';
import { CardiacChannel } from './channels/CardiacChannel';
import { LipidsResult } from './channels/LipidsChannel';

/**
 * Class for optimized signal distribution to specialized channels
 */
export class OptimizedSignalDistributor {
  // Active channels by type
  private channels = new Map<VitalSignType, OptimizedSignalChannel>();
  
  // Processing configuration
  private config: SignalDistributorConfig = { 
    globalAdaptationRate: 0.3,
    calibrationMode: false
  };
  
  // Processing diagnostics
  private diagnostics: SignalDiagnosticInfo = {
    quality: 0,
    fingerDetected: false,
    signalStrength: 0,
    processingTime: 0,
    adaptationRate: 0.3
  };
  
  /**
   * Create a new signal distributor with default channels
   */
  constructor(channels?: OptimizedSignalChannel[]) {
    // If channels provided, register them
    if (channels && channels.length > 0) {
      for (const channel of channels) {
        this.registerChannel(channel);
      }
    } else {
      // Initialize default channels
      this.registerChannel(new GlucoseChannel() as unknown as OptimizedSignalChannel);
      this.registerChannel(new LipidsChannel() as unknown as OptimizedSignalChannel);
      this.registerChannel(new BloodPressureChannel() as unknown as OptimizedSignalChannel);
      this.registerChannel(new SpO2Channel() as unknown as OptimizedSignalChannel);
      this.registerChannel(new CardiacChannel() as unknown as OptimizedSignalChannel);
    }
  }
  
  /**
   * Register a new channel
   */
  registerChannel(channel: OptimizedSignalChannel): void {
    this.channels.set(channel.getType(), channel);
  }
  
  /**
   * Remove a channel
   */
  removeChannel(type: VitalSignType): void {
    this.channels.delete(type);
  }
  
  /**
   * Get a channel by type
   */
  getChannel<T extends OptimizedSignalChannel>(type: VitalSignType): T | null {
    const channel = this.channels.get(type);
    return channel as T || null;
  }
  
  /**
   * Process a signal through all channels
   */
  processSignal(signal: number, config?: SignalDistributorConfig): SignalProcessingResult {
    const startTime = Date.now();
    const channelResults = new Map<VitalSignType, any>();
    
    // Update configuration if provided
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // Update diagnostics
    this.diagnostics.quality = 0;
    this.diagnostics.signalStrength = Math.abs(signal);
    
    // Process signal through all channels
    for (const [type, channel] of this.channels.entries()) {
      try {
        const result = channel.processValue(signal);
        channelResults.set(type, result);
      } catch (error) {
        console.error(`Error processing signal in ${type} channel:`, error);
      }
    }
    
    // Calculate processing time
    this.diagnostics.processingTime = Date.now() - startTime;
    
    // Return results
    return {
      timestamp: Date.now(),
      channelResults,
      diagnostics: { ...this.diagnostics }
    };
  }
  
  /**
   * Get glucose value
   */
  getGlucose(): number {
    const glucoseChannel = this.getChannel<GlucoseChannel>(VitalSignType.GLUCOSE);
    if (!glucoseChannel) return 0;
    
    return (glucoseChannel as unknown as GlucoseChannel).getLastGlucose();
  }
  
  /**
   * Get lipids values
   */
  getLipids(): LipidsResult {
    const lipidsChannel = this.getChannel<LipidsChannel>(VitalSignType.LIPIDS);
    if (!lipidsChannel) {
      return { totalCholesterol: 0, triglycerides: 0 };
    }
    
    return (lipidsChannel as unknown as LipidsChannel).getLastResult();
  }
  
  /**
   * Get blood pressure values
   */
  getBloodPressure(): BloodPressureResult {
    const bpChannel = this.getChannel<BloodPressureChannel>(VitalSignType.BLOOD_PRESSURE);
    if (!bpChannel) {
      return { systolic: 0, diastolic: 0 };
    }
    
    return (bpChannel as unknown as BloodPressureChannel).getLastResult();
  }
  
  /**
   * Get SpO2 value
   */
  getSpO2(): number {
    const spo2Channel = this.getChannel<SpO2Channel>(VitalSignType.SPO2);
    if (!spo2Channel) return 0;
    
    return (spo2Channel as unknown as SpO2Channel).getLastSpO2();
  }
  
  /**
   * Get cardiac values
   */
  getCardiac(): CardiacResult {
    const cardiacChannel = this.getChannel<CardiacChannel>(VitalSignType.CARDIAC);
    if (!cardiacChannel) {
      return { bpm: 0, confidence: 0, isPeak: false };
    }
    
    return (cardiacChannel as unknown as CardiacChannel).getLastResult();
  }
  
  /**
   * Reset all channels
   */
  reset(): void {
    for (const channel of this.channels.values()) {
      channel.reset();
    }
    
    // Reset diagnostics
    this.diagnostics = {
      quality: 0,
      fingerDetected: false,
      signalStrength: 0,
      processingTime: 0,
      adaptationRate: this.config.globalAdaptationRate || 0.3
    };
  }
  
  /**
   * Start processing - method for compatibility with ModularVitalSignsProcessor
   */
  start(): void {
    // Reset all channels to ensure clean start
    this.reset();
  }
  
  /**
   * Stop processing - method for compatibility with ModularVitalSignsProcessor
   */
  stop(): void {
    // No specific action needed for stopping
  }
  
  /**
   * Get diagnostic information
   */
  getDiagnostics(): SignalDiagnosticInfo {
    return { ...this.diagnostics };
  }
  
  /**
   * Apply feedback to channels
   */
  applyFeedback(type: VitalSignType, feedback: any): void {
    // Implementation for feedback mechanism
    console.log(`Feedback received for ${type}:`, feedback);
    
    // Future implementation could update channel parameters based on feedback
  }
}
