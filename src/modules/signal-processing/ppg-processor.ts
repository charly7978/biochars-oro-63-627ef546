/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { ProcessedPPGSignal, SignalProcessingOptions } from './types';
import { PPGSignalProcessor } from './interfaces';
import { calculateEMA } from '../vital-signs/utils/statistics-utils';
import { normalizeValue, amplifySignal } from '../vital-signs/utils/signal-utils';

/**
 * Processor for PPG signals
 * Direct measurement only, no simulation
 */
export class PPGProcessor implements PPGSignalProcessor {
  private signalBuffer: number[] = [];
  private filteredBuffer: number[] = [];
  private fingerDetected: boolean = false;
  private signalQuality: number = 0;
  private lastTimestamp: number = 0;
  private options: SignalProcessingOptions = {
    filterStrength: 0.3,
    qualityThreshold: 0.4,
    fingerDetectionSensitivity: 0.05,
    amplificationFactor: 1.2
  };
  
  /**
   * Configure the processor with new options
   */
  configure(options: Partial<SignalProcessingOptions>): void {
    this.options = { ...this.options, ...options };
    console.log("PPGProcessor: Configured with options", this.options);
  }
  
  /**
   * Process a PPG signal and return processed data
   */
  processSignal(signal: number): ProcessedPPGSignal {
    // Add to buffer
    this.signalBuffer.push(signal);
    
    // Keep buffer at reasonable size
    if (this.signalBuffer.length > 128) {
      this.signalBuffer.shift();
    }
    
    // Apply filtering
    const filtered = this.applyFiltering(signal);
    this.filteredBuffer.push(filtered);
    
    if (this.filteredBuffer.length > 128) {
      this.filteredBuffer.shift();
    }
    
    // Calculate normalized value
    const normalized = this.normalizeSignal(filtered);
    
    // Detect finger presence
    this.fingerDetected = this.detectFinger(signal);
    
    // Calculate signal quality
    this.calculateSignalQuality(filtered);
    
    // Calculate signal strength
    const signalStrength = this.calculateSignalStrength(filtered);
    
    // Apply amplification
    const amplified = this.amplifySignal(normalized);
    
    // Create result
    const now = Date.now();
    this.lastTimestamp = now;
    
    return {
      timestamp: now,
      rawValue: signal,
      filteredValue: filtered,
      normalizedValue: normalized,
      quality: this.signalQuality,
      fingerDetected: this.fingerDetected,
      amplifiedValue: amplified,
      signalStrength
    };
  }
  
  /**
   * Reset the processor state
   */
  reset(): void {
    this.signalBuffer = [];
    this.filteredBuffer = [];
    this.fingerDetected = false;
    this.signalQuality = 0;
    this.lastTimestamp = 0;
    console.log("PPGProcessor: Reset complete");
  }
  
  /**
   * Apply filtering to the input signal
   */
  private applyFiltering(signal: number): number {
    return calculateEMA(signal, this.signalBuffer, this.options.filterStrength || 0.3);
  }
  
  /**
   * Normalize the signal relative to recent history
   */
  private normalizeSignal(filtered: number): number {
    if (this.filteredBuffer.length < 5) return 0;
    
    return normalizeValue(filtered, this.filteredBuffer);
  }
  
  /**
   * Detect if a finger is present based on signal characteristics
   */
  private detectFinger(signal: number): boolean {
    if (this.signalBuffer.length < 10) return false;
    
    // Calculate signal variation
    const recentValues = this.signalBuffer.slice(-10);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const deviation = recentValues.map(v => Math.abs(v - mean)).reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Detect based on absolute signal level and variation
    const sensitivity = this.options.fingerDetectionSensitivity || 0.05;
    const signalPresent = Math.abs(mean) > 0.1;
    const variationPresent = deviation > sensitivity;
    
    return signalPresent && variationPresent;
  }
  
  /**
   * Calculate signal quality based on multiple factors
   */
  private calculateSignalQuality(filtered: number): number {
    if (this.filteredBuffer.length < 10) {
      this.signalQuality = 0;
      return this.signalQuality;
    }
    
    // Calculate based on signal stability
    const recentValues = this.filteredBuffer.slice(-10);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const maxDev = Math.max(...recentValues.map(v => Math.abs(v - mean)));
    
    const threshold = this.options.qualityThreshold || 0.4;
    const stability = 1 - Math.min(1, maxDev / threshold);
    
    // Calculate based on signal presence
    const signalPresence = Math.min(1, Math.abs(mean) / 0.2);
    
    // Combine factors
    this.signalQuality = Math.round((stability * 0.7 + signalPresence * 0.3) * 100);
    
    return this.signalQuality;
  }
  
  /**
   * Calculate signal strength as a percentage
   */
  private calculateSignalStrength(filtered: number): number {
    if (this.filteredBuffer.length < 5) return 0;
    
    const recentValues = this.filteredBuffer.slice(-5);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const amplitude = max - min;
    
    // Map amplitude to percentage with reasonable cutoffs
    return Math.min(100, Math.round(amplitude * 200));
  }
  
  /**
   * Amplify the signal when needed
   */
  private amplifySignal(normalized: number): number {
    const factor = this.options.amplificationFactor || 1.2;
    return amplifySignal(normalized, factor);
  }
}
