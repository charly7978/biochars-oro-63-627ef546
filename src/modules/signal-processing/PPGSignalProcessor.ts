/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * PPG Signal Processor Implementation
 */

import { ProcessedPPGSignal } from './types';

/**
 * Processes PPG signals from raw input
 */
export class PPGSignalProcessor {
  private buffer: number[] = [];
  private readonly maxBufferSize: number = 50;
  
  /**
   * Process a new PPG value
   */
  public processValue(value: number): ProcessedPPGSignal {
    // Add value to buffer
    this.buffer.push(value);
    
    // Keep buffer size in check
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
    
    // Calculate signal metrics
    const filteredValue = this.filterValue(value);
    const normalizedValue = this.normalizeValue(filteredValue);
    const quality = this.calculateQuality(normalizedValue);
    
    return {
      timestamp: Date.now(),
      rawValue: value,
      filteredValue,
      normalizedValue,
      quality,
      fingerDetected: quality > 0.2
    };
  }
  
  /**
   * Apply basic filtering to smooth the signal
   */
  private filterValue(value: number): number {
    if (this.buffer.length < 3) return value;
    
    // Simple moving average
    const recentValues = this.buffer.slice(-3);
    return recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
  }
  
  /**
   * Normalize value to a standard range
   */
  private normalizeValue(value: number): number {
    if (this.buffer.length < 5) return value;
    
    const recentValues = this.buffer.slice(-10);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  }
  
  /**
   * Calculate signal quality based on variance and stability
   */
  private calculateQuality(value: number): number {
    if (this.buffer.length < 10) return 0.5;
    
    const recentValues = this.buffer.slice(-10);
    
    // Calculate variance
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    
    // Low variance in a valid range indicates better quality
    const varianceQuality = Math.max(0, 1 - Math.min(1, variance * 10));
    
    // Having values in an appropriate range indicates better quality
    const rangeQuality = value > 0.1 && value < 0.9 ? 1 : 0.5;
    
    return varianceQuality * 0.7 + rangeQuality * 0.3;
  }
  
  /**
   * Reset the processor state
   */
  public reset(): void {
    this.buffer = [];
  }
}
