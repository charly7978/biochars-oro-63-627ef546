/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Heartbeat Signal Processor Implementation
 */

import { ProcessedHeartbeatSignal } from './types';

/**
 * Processes heartbeat signals from PPG data
 */
export class HeartbeatProcessor {
  private valueBuffer: number[] = [];
  private peakBuffer: number[] = [];
  private lastPeakTime: number | null = null;
  private readonly maxBufferSize: number = 100;
  private readonly maxPeakBufferSize: number = 10;
  private readonly minPeakDistance: number = 300; // minimum ms between peaks
  
  /**
   * Process a new filtered PPG value
   */
  public processValue(value: number): ProcessedHeartbeatSignal {
    // Add value to buffer
    this.valueBuffer.push(value);
    const timestamp = Date.now();
    
    // Keep buffer size in check
    if (this.valueBuffer.length > this.maxBufferSize) {
      this.valueBuffer.shift();
    }
    
    // Check for peak
    const isPeak = this.detectPeak(value, timestamp);
    const bpm = this.calculateBPM();
    const rrInterval = this.lastPeakTime ? (timestamp - this.lastPeakTime) : null;
    
    return {
      timestamp,
      value,
      isPeak,
      bpm,
      rrInterval,
      confidence: this.calculateConfidence()
    };
  }
  
  /**
   * Detect if the current value is a peak
   */
  private detectPeak(value: number, timestamp: number): boolean {
    if (this.valueBuffer.length < 3) return false;
    
    const prev = this.valueBuffer[this.valueBuffer.length - 2];
    const prevPrev = this.valueBuffer[this.valueBuffer.length - 3];
    
    // Check if this point is higher than the previous points
    const isPotentialPeak = value > prev && prev >= prevPrev;
    
    // Enforce minimum time between peaks
    const enoughTimePassed = !this.lastPeakTime || (timestamp - this.lastPeakTime) > this.minPeakDistance;
    
    if (isPotentialPeak && enoughTimePassed) {
      this.peakBuffer.push(timestamp);
      this.lastPeakTime = timestamp;
      
      // Keep peak buffer size in check
      if (this.peakBuffer.length > this.maxPeakBufferSize) {
        this.peakBuffer.shift();
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Calculate the current BPM based on recent peaks
   */
  private calculateBPM(): number {
    if (this.peakBuffer.length < 2) return 0;
    
    // Calculate average interval between peaks
    const intervals: number[] = [];
    for (let i = 1; i < this.peakBuffer.length; i++) {
      intervals.push(this.peakBuffer[i] - this.peakBuffer[i - 1]);
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    // Convert to BPM (60000 ms in a minute)
    return Math.round(60000 / avgInterval);
  }
  
  /**
   * Calculate confidence level in the current BPM
   */
  private calculateConfidence(): number {
    if (this.peakBuffer.length < 3) return 0.5;
    
    // Calculate variance in intervals
    const intervals: number[] = [];
    for (let i = 1; i < this.peakBuffer.length; i++) {
      intervals.push(this.peakBuffer[i] - this.peakBuffer[i - 1]);
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    
    // Higher variance = lower confidence
    const varianceConfidence = Math.max(0, 1 - Math.sqrt(variance) / 200);
    
    // More peaks = higher confidence
    const countConfidence = Math.min(1, this.peakBuffer.length / 5);
    
    return varianceConfidence * 0.7 + countConfidence * 0.3;
  }
  
  /**
   * Reset the processor state
   */
  public reset(): void {
    this.valueBuffer = [];
    this.peakBuffer = [];
    this.lastPeakTime = null;
  }
}
