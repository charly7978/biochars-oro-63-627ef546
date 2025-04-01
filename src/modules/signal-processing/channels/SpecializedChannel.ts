/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Base class for specialized signal processing channels
 */

import { v4 as uuidv4 } from 'uuid';
import { OptimizedSignalChannel } from '../interfaces';

/**
 * Supported vital sign types
 */
export enum VitalSignType {
  CARDIAC = 'cardiac',
  SPO2 = 'spo2',
  BLOOD_PRESSURE = 'blood_pressure',
  GLUCOSE = 'glucose',
  LIPIDS = 'lipids'
}

/**
 * Base specialized channel implementation
 */
export abstract class SpecializedChannel implements OptimizedSignalChannel {
  /**
   * Unique channel ID
   */
  public id: string;

  /**
   * Channel type
   */
  protected type: VitalSignType;
  
  /**
   * Values buffer
   */
  protected values: number[] = [];
  
  /**
   * Timestamps for values
   */
  protected timestamps: number[] = [];
  
  /**
   * Create a new specialized channel
   */
  constructor(type: VitalSignType, id?: string) {
    this.type = type;
    this.id = id || uuidv4();
  }
  
  /**
   * Get the channel type
   */
  public getType(): VitalSignType {
    return this.type;
  }
  
  /**
   * Process a new signal value
   * Each specialized channel needs to implement this
   */
  abstract processValue(signal: number): any;
  
  /**
   * Check if this channel matches a specified type
   */
  public isType(type: VitalSignType): boolean {
    return this.type === type;
  }
  
  /**
   * Get the channel ID
   */
  public getId(): string {
    return this.id;
  }
  
  /**
   * Reset the channel
   * Should be implemented by subclasses to perform specialized reset
   */
  public reset(): void {
    this.values = [];
    this.timestamps = [];
  }
  
  /**
   * Get the latest value
   */
  public getLatestValue(): number | null {
    if (this.values.length === 0) return null;
    return this.values[this.values.length - 1];
  }
  
  /**
   * Add a new value to the channel's buffer
   */
  protected addValue(value: number): void {
    this.values.push(value);
    this.timestamps.push(Date.now());
    
    // Keep buffer at reasonable size
    const MAX_BUFFER_SIZE = 100;
    if (this.values.length > MAX_BUFFER_SIZE) {
      this.values.shift();
      this.timestamps.shift();
    }
  }
  
  /**
   * Get channel buffer
   */
  public getValues(): number[] {
    return [...this.values];
  }
  
  /**
   * Get value timestamps
   */
  public getTimestamps(): number[] {
    return [...this.timestamps];
  }
  
  /**
   * Get last N values from buffer
   */
  protected getLastValues(count: number): number[] {
    if (this.values.length <= count) {
      return [...this.values];
    }
    
    return this.values.slice(-count);
  }
}
