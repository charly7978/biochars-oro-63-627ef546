
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Base class for all specialized signal processing channels
 */

import { OptimizedSignalChannel } from '../types';

/**
 * Base abstract class for specialized signal channels
 * Each channel handles a specific vital sign processing
 */
export abstract class SpecializedChannel implements OptimizedSignalChannel {
  // Channel type identifier - now public to match the interface
  public readonly type: string;
  
  // Common buffer for all channels
  protected recentValues: number[] = [];
  protected readonly maxBufferSize: number = 30;
  
  constructor(type: string) {
    this.type = type;
  }
  
  /**
   * Process a signal value and return channel-specific output
   */
  abstract processSignal(signal: number): any;
  
  /**
   * Calculate quality score for this channel's processing
   */
  abstract calculateQuality(signal: number): number;
  
  /**
   * Add value to buffer and maintain buffer size
   */
  protected addToBuffer(value: number): void {
    this.recentValues.push(value);
    if (this.recentValues.length > this.maxBufferSize) {
      this.recentValues.shift();
    }
  }
  
  /**
   * Reset channel state
   */
  public reset(): void {
    this.recentValues = [];
  }
  
  /**
   * Get variance of recent values
   */
  protected getVariance(): number {
    if (this.recentValues.length < 2) return 0;
    
    const mean = this.getMean();
    return this.recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.recentValues.length;
  }
  
  /**
   * Get mean of recent values
   */
  protected getMean(): number {
    if (this.recentValues.length === 0) return 0;
    return this.recentValues.reduce((sum, val) => sum + val, 0) / this.recentValues.length;
  }
  
  /**
   * Apply basic filtering to smooth values
   */
  protected smoothValue(value: number): number {
    if (this.recentValues.length < 3) return value;
    
    const recentValuesCopy = [...this.recentValues, value].slice(-3);
    return recentValuesCopy.reduce((sum, val) => sum + val, 0) / recentValuesCopy.length;
  }
}
