
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * PPG Signal Processor implementation
 */

import { applyAdaptiveFilter } from './utils/adaptive-predictor';
import { isFingerDetected, getSignalStrength } from './finger-detector';

class PPGSignalProcessor {
  private buffer: number[] = [];
  private timestamps: number[] = [];
  private maxBufferSize = 100;
  private lastProcessedValue: number = 0;
  private isProcessing: boolean = false;

  constructor() {
    console.log("PPGSignalProcessor initialized");
  }

  /**
   * Start processing
   */
  startProcessing(): void {
    this.isProcessing = true;
    console.log("PPGSignalProcessor: Processing started");
  }

  /**
   * Stop processing
   */
  stopProcessing(): void {
    this.isProcessing = false;
    console.log("PPGSignalProcessor: Processing stopped");
  }

  /**
   * Process a new signal value
   */
  processValue(value: number): number {
    if (!this.isProcessing) return 0;
    
    // Add to buffer
    this.buffer.push(value);
    this.timestamps.push(Date.now());
    
    // Keep buffer at reasonable size
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
      this.timestamps.shift();
    }
    
    // Process value if we have enough data
    if (this.buffer.length >= 3) {
      // Pass the entire buffer to applyAdaptiveFilter
      this.lastProcessedValue = applyAdaptiveFilter(value, this.buffer, 0.3);
      return this.lastProcessedValue;
    }
    
    return value;
  }

  /**
   * Process signal with more details for signal processing hooks
   * This is the method called by the PPG processor components
   */
  processSignal(value: number): {
    timestamp: number;
    rawValue: number;
    filteredValue: number;
    normalizedValue: number;
    amplifiedValue: number;
    quality: number;
    fingerDetected: boolean;
    signalStrength: number;
    value: number; // Add this field for compatibility
    isPeak: boolean; // Add for heartbeat detection
    confidence: number; // Add for quality assessment
    instantaneousBPM: number; // Add for heart rate calculation
    rrInterval: number | null; // Add for RR interval calculation
    bpm: number; // Add for BPM tracking
    heartRateVariability: number; // Add for HRV calculation
  } {
    const timestamp = Date.now();
    const processedValue = this.processValue(value);
    const fingerDetected = isFingerDetected(this.buffer);
    const signalStrength = getSignalStrength(this.buffer);
    
    // Calculate quality from signal strength
    const quality = Math.min(100, Math.round(signalStrength * 100)) / 100;
    
    // Determine if this is a peak (simplified for compatibility)
    const isPeak = false; // Would be determined by peak detection algorithm
    
    // Calculate instantaneous BPM (simplified for compatibility)
    const instantaneousBPM = 0; // Would be calculated from actual peaks
    
    // Calculate BPM (simplified for compatibility)
    const bpm = 0; // Would be calculated from peaks over time
    
    // Calculate heart rate variability (simplified for compatibility)
    const heartRateVariability = 0; // Would be calculated from RR intervals
    
    return {
      timestamp,
      rawValue: value,
      filteredValue: processedValue,
      normalizedValue: processedValue,
      amplifiedValue: processedValue * 2,
      quality,
      fingerDetected,
      signalStrength,
      value: processedValue, // Add for compatibility
      isPeak,
      confidence: quality,
      instantaneousBPM,
      rrInterval: null,
      bpm,
      heartRateVariability
    };
  }

  /**
   * Reset the processor state
   */
  reset(): void {
    this.buffer = [];
    this.timestamps = [];
    this.lastProcessedValue = 0;
    console.log("PPGSignalProcessor: Reset complete");
  }

  /**
   * Get last processed value
   */
  getLastValue(): number {
    return this.lastProcessedValue;
  }

  /**
   * Get processing status
   */
  isActive(): boolean {
    return this.isProcessing;
  }

  /**
   * Get the current buffer
   */
  getBuffer(): number[] {
    return [...this.buffer];
  }
}

export { PPGSignalProcessor };
