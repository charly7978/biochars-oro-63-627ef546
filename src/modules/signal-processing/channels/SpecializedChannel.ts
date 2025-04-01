
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Base class for specialized signal processing channels
 */

import { OptimizedSignalChannel } from '../types';

/**
 * Enum for vital sign types
 */
export enum VitalSignType {
  GLUCOSE = 'glucose',
  LIPIDS = 'lipids',
  BLOOD_PRESSURE = 'blood_pressure',
  SPO2 = 'spo2',
  CARDIAC = 'cardiac'
}

/**
 * Base class for all specialized signal processing channels
 */
export abstract class SpecializedChannel implements OptimizedSignalChannel {
  public type: VitalSignType;
  public id: string;
  protected recentValues: number[] = [];
  protected maxBufferSize: number = 100;
  protected currentQuality: number = 0;
  protected isActive: boolean = true;
  
  constructor(type: VitalSignType) {
    this.type = type;
    this.id = `${type.toLowerCase()}-${Date.now()}`;
  }
  
  /**
   * Process a signal value through this channel
   */
  abstract processSignal(signal: number): any;
  
  /**
   * Process a signal value with optional additional context
   */
  processValue(signal: number): any {
    return this.processSignal(signal);
  }
  
  /**
   * Calculate signal quality for this channel
   */
  calculateQuality(signal: number): number {
    // Add to recent values
    this.addToBuffer(signal);
    
    // Simple quality: stable non-zero signal
    if (this.recentValues.length < 5) {
      this.currentQuality = 0.5;
      return this.currentQuality;
    }
    
    // Calculate statistics
    const mean = this.getMean();
    const variance = this.getVariance();
    
    // Calculate quality metrics
    const absSignal = Math.abs(signal);
    const signalPresent = absSignal > 0.01 ? 1 : 0;
    const stability = Math.max(0, 1 - Math.sqrt(variance) / Math.max(0.01, Math.abs(mean)));
    
    // Update quality
    this.currentQuality = 0.3 * this.currentQuality + 0.7 * (0.7 * stability + 0.3 * signalPresent);
    
    return this.currentQuality;
  }

  /**
   * Get the current quality value
   */
  getQuality(): number {
    return this.currentQuality;
  }
  
  /**
   * Reset the channel state
   */
  reset(): void {
    this.recentValues = [];
    this.currentQuality = 0;
  }
  
  /**
   * Apply feedback to the channel
   */
  applyFeedback(feedback: any): void {
    // Base implementation does nothing
  }

  /**
   * Add a value to the buffer
   */
  protected addToBuffer(value: number): void {
    this.recentValues.push(value);
    if (this.recentValues.length > this.maxBufferSize) {
      this.recentValues.shift();
    }
  }

  /**
   * Calculate mean of recent values
   */
  protected getMean(): number {
    if (this.recentValues.length === 0) return 0;
    return this.recentValues.reduce((sum, val) => sum + val, 0) / this.recentValues.length;
  }

  /**
   * Calculate variance of recent values
   */
  protected getVariance(): number {
    if (this.recentValues.length < 2) return 0;
    const mean = this.getMean();
    return this.recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.recentValues.length;
  }

  /**
   * Apply smoothing to the value
   */
  protected smoothValue(value: number, windowSize: number = 5): number {
    if (this.recentValues.length < windowSize) return value;
    
    const window = this.recentValues.slice(-windowSize);
    return window.reduce((sum, val) => sum + val, 0) / windowSize;
  }
}
