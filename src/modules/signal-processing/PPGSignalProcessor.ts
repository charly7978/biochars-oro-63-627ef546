
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Implementation of PPG signal processor
 */

import { ProcessedPPGSignal, SignalProcessingOptions, SignalProcessor } from './types';
import { detectFinger } from './finger-detector';

/**
 * Processes raw PPG signals to extract features
 */
export class PPGSignalProcessor implements SignalProcessor {
  private options: SignalProcessingOptions = {
    filterStrength: 0.3,
    qualityThreshold: 0.4,
    adaptiveFiltering: true,
    fingerDetectionSensitivity: 1.0,
    amplificationFactor: 3.0
  };
  
  private lastValues: number[] = [];
  private filteredValues: number[] = [];
  private rawBuffer: number[] = [];
  private smoothedBuffer: number[] = [];
  private normalizedBuffer: number[] = [];
  private currentQuality: number = 0;
  private maxBufferSize: number = 200;
  
  /**
   * Process a PPG signal value
   */
  processSignal(value: number): ProcessedPPGSignal {
    const timestamp = Date.now();
    
    // Add to buffers
    this.rawBuffer.push(value);
    if (this.rawBuffer.length > this.maxBufferSize) {
      this.rawBuffer.shift();
    }
    
    // Apply filtering
    let filteredValue = this.applyFilter(value);
    this.filteredValues.push(filteredValue);
    if (this.filteredValues.length > this.maxBufferSize) {
      this.filteredValues.shift();
    }
    
    // Calculate quality
    this.currentQuality = this.calculateQuality(filteredValue);
    
    // Normalize
    const normalizedValue = this.normalizeValue(filteredValue);
    this.normalizedBuffer.push(normalizedValue);
    if (this.normalizedBuffer.length > this.maxBufferSize) {
      this.normalizedBuffer.shift();
    }
    
    // Detect finger
    const fingerDetected = detectFinger(this.currentQuality, filteredValue);
    
    // Calculate amplified value for heartbeat processing
    const amplifiedValue = filteredValue * (this.options.amplificationFactor || 3.0);
    
    // Calculate signal strength (absolute amplitude)
    const signalStrength = Math.abs(filteredValue);
    
    // Return processed signal
    return {
      timestamp,
      rawValue: value,
      filteredValue,
      normalizedValue,
      quality: this.currentQuality * 100, // Scale to 0-100 range
      fingerDetected,
      amplifiedValue,
      signalStrength
    };
  }
  
  /**
   * Apply signal filter
   */
  private applyFilter(value: number): number {
    // Apply smoothing filter based on settings
    const alpha = this.options.filterStrength || 0.3;
    
    if (this.lastValues.length === 0) {
      this.lastValues.push(value);
      return value;
    }
    
    // Calculate filtered value
    const lastValue = this.lastValues[this.lastValues.length - 1];
    const filtered = alpha * value + (1 - alpha) * lastValue;
    
    // Update last values
    this.lastValues.push(filtered);
    if (this.lastValues.length > 10) {
      this.lastValues.shift();
    }
    
    return filtered;
  }
  
  /**
   * Calculate signal quality
   */
  private calculateQuality(value: number): number {
    if (this.filteredValues.length < 10) {
      return 0.5; // Initial quality
    }
    
    // Calculate signal statistics
    const recentValues = this.filteredValues.slice(-20);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate quality based on metrics
    const signalPresent = Math.abs(value) > 0.01 ? 1 : 0;
    const stability = Math.max(0, 1 - stdDev / Math.max(0.01, Math.abs(mean)));
    
    return 0.4 * stability + 0.6 * signalPresent;
  }
  
  /**
   * Normalize value
   */
  private normalizeValue(value: number): number {
    if (this.filteredValues.length < 5) return value;
    
    // Find min/max in recent window
    const recentValues = this.filteredValues.slice(-30);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;
    
    if (range < 0.001) return 0.5; // Handle zero or near-zero range
    
    return (value - min) / range;
  }
  
  /**
   * Reset the processor state
   */
  reset(): void {
    this.lastValues = [];
    this.filteredValues = [];
    this.rawBuffer = [];
    this.smoothedBuffer = [];
    this.normalizedBuffer = [];
    this.currentQuality = 0;
  }
  
  /**
   * Configure the processor
   */
  configure(options: Partial<SignalProcessingOptions>): void {
    if (options.amplificationFactor !== undefined) {
      this.options.amplificationFactor = options.amplificationFactor;
    }
    
    if (options.filterStrength !== undefined) {
      this.options.filterStrength = options.filterStrength;
    }
    
    if (options.qualityThreshold !== undefined) {
      this.options.qualityThreshold = options.qualityThreshold;
    }
    
    if (options.adaptiveFiltering !== undefined) {
      this.options.adaptiveFiltering = options.adaptiveFiltering;
    }
    
    if (options.fingerDetectionSensitivity !== undefined) {
      this.options.fingerDetectionSensitivity = options.fingerDetectionSensitivity;
    }
  }
}
