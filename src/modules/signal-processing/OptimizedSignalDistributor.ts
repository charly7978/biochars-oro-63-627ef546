
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Optimized signal distribution for multiple channels
 */

import { OptimizedSignalChannel, ProcessedPPGSignal } from './types';
import { GlucoseChannel } from './channels/GlucoseChannel';
import { LipidsChannel } from './channels/LipidsChannel';
import { BloodPressureChannel } from './channels/BloodPressureChannel';
import { SpO2Channel } from './channels/SpO2Channel';
import { CardiacChannel } from './channels/CardiacChannel';
import { VitalSignType } from './channels/SpecializedChannel';

/**
 * Distributes signal to multiple specialized channels
 */
export class OptimizedSignalDistributor {
  private channels: Map<VitalSignType, OptimizedSignalChannel> = new Map();
  private ppgBuffer: ProcessedPPGSignal[] = [];
  private maxBufferSize: number = 50;
  private resultsCallback: ((results: any) => void) | null = null;
  
  constructor() {
    // Initialize default channels
    this.initializeDefaultChannels();
  }
  
  /**
   * Initialize the default set of specialized channels
   */
  private initializeDefaultChannels(): void {
    this.channels.set(VitalSignType.GLUCOSE, new GlucoseChannel());
    this.channels.set(VitalSignType.LIPIDS, new LipidsChannel());
    this.channels.set(VitalSignType.BLOOD_PRESSURE, new BloodPressureChannel());
    this.channels.set(VitalSignType.SPO2, new SpO2Channel());
    this.channels.set(VitalSignType.CARDIAC, new CardiacChannel());
  }
  
  /**
   * Process PPG signal through all channels
   */
  processPPGSignal(signal: ProcessedPPGSignal): void {
    // Store signal in buffer
    this.ppgBuffer.push(signal);
    if (this.ppgBuffer.length > this.maxBufferSize) {
      this.ppgBuffer.shift();
    }
    
    // Only process if finger is detected and quality is acceptable
    if (signal.fingerDetected && signal.quality > 0.4) {
      // Process through each channel
      const results = {};
      
      for (const [type, channel] of this.channels.entries()) {
        const result = channel.processSignal(signal.filteredValue);
        results[type] = result;
      }
      
      // If callback is registered, send results
      if (this.resultsCallback) {
        this.resultsCallback(results);
      }
    }
  }
  
  /**
   * Register callback for results
   */
  onResults(callback: (results: any) => void): void {
    this.resultsCallback = callback;
  }
  
  /**
   * Get channel by type
   */
  getChannel(type: VitalSignType): OptimizedSignalChannel | undefined {
    return this.channels.get(type);
  }
  
  /**
   * Add a custom channel
   */
  addChannel(channel: OptimizedSignalChannel): void {
    this.channels.set(channel.type, channel);
  }
  
  /**
   * Remove a channel
   */
  removeChannel(type: VitalSignType): boolean {
    return this.channels.delete(type);
  }
  
  /**
   * Get glucose channel
   */
  getGlucoseChannel(): GlucoseChannel {
    const channel = this.channels.get(VitalSignType.GLUCOSE);
    if (!channel) {
      const newChannel = new GlucoseChannel();
      this.channels.set(VitalSignType.GLUCOSE, newChannel);
      return newChannel;
    }
    return channel as GlucoseChannel;
  }
  
  /**
   * Get lipids channel
   */
  getLipidsChannel(): LipidsChannel {
    const channel = this.channels.get(VitalSignType.LIPIDS);
    if (!channel) {
      const newChannel = new LipidsChannel();
      this.channels.set(VitalSignType.LIPIDS, newChannel);
      return newChannel;
    }
    return channel as LipidsChannel;
  }
  
  /**
   * Get blood pressure channel
   */
  getBloodPressureChannel(): BloodPressureChannel {
    const channel = this.channels.get(VitalSignType.BLOOD_PRESSURE);
    if (!channel) {
      const newChannel = new BloodPressureChannel();
      this.channels.set(VitalSignType.BLOOD_PRESSURE, newChannel);
      return newChannel;
    }
    return channel as BloodPressureChannel;
  }
  
  /**
   * Get SpO2 channel
   */
  getSpO2Channel(): SpO2Channel {
    const channel = this.channels.get(VitalSignType.SPO2);
    if (!channel) {
      const newChannel = new SpO2Channel();
      this.channels.set(VitalSignType.SPO2, newChannel);
      return newChannel;
    }
    return channel as SpO2Channel;
  }
  
  /**
   * Get cardiac channel
   */
  getCardiacChannel(): CardiacChannel {
    const channel = this.channels.get(VitalSignType.CARDIAC);
    if (!channel) {
      const newChannel = new CardiacChannel();
      this.channels.set(VitalSignType.CARDIAC, newChannel);
      return newChannel;
    }
    return channel as CardiacChannel;
  }
  
  /**
   * Reset all channels
   */
  reset(): void {
    for (const channel of this.channels.values()) {
      channel.reset();
    }
    this.ppgBuffer = [];
  }
}
