/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Heartbeat Processor - Detects peaks and calculates heart rate
 */

import { SignalProcessor, ProcessedHeartbeatSignal, SignalProcessingOptions } from './types';

/**
 * Default options
 */
const DEFAULT_OPTIONS: SignalProcessingOptions = {
  amplificationFactor: 1.5,
  filterStrength: 0.5,
  qualityThreshold: 0.3,
  fingerDetectionSensitivity: 0.5
};

/**
 * Heartbeat processor
 * Detects beats and calculates heart rate from PPG signal
 */
export class HeartbeatProcessor implements SignalProcessor<ProcessedHeartbeatSignal> {
  private options: SignalProcessingOptions;
  private buffer: number[] = [];
  private readonly BUFFER_SIZE = 100;
  private timestamps: number[] = [];
  private peakThreshold: number = 0.1;
  private lastPeakTime: number | null = null;
  private rrIntervals: number[] = [];
  private readonly MAX_RR_INTERVALS = 10;
  
  /**
   * Constructor
   */
  constructor(options: Partial<SignalProcessingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    console.log("HeartBeatProcessor: New instance created - direct measurement mode only");
  }
  
  /**
   * Configure the processor
   */
  public configure(options: Partial<SignalProcessingOptions>): void {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * Process a single value from the PPG signal
   */
  public processSignal(value: number): ProcessedHeartbeatSignal {
    const timestamp = Date.now();
    
    // Add to buffer
    this.buffer.push(value);
    this.timestamps.push(timestamp);
    
    // Keep buffer size limited
    if (this.buffer.length > this.BUFFER_SIZE) {
      this.buffer.shift();
      this.timestamps.shift();
    }
    
    // Initialize with default values
    let result: ProcessedHeartbeatSignal = {
      timestamp,
      value,
      isPeak: false,
      peakConfidence: 0,
      instantaneousBPM: null,
      rrInterval: null,
      heartRateVariability: null
    };
    
    // Need minimum buffer size for peak detection
    if (this.buffer.length < 3) {
      return result;
    }
    
    // Adaptive peak threshold
    this.updatePeakThreshold();
    
    // Check for peak - current value higher than previous and next, and above threshold
    const isPeak = this.detectPeak(value);
    
    // Process peak detection results
    if (isPeak) {
      result.isPeak = true;
      result.peakConfidence = this.calculatePeakConfidence(value);
      
      // Calculate RR interval if last peak time exists
      if (this.lastPeakTime !== null) {
        const rrInterval = timestamp - this.lastPeakTime;
        
        // Only use physiologically valid intervals (20-200 BPM)
        if (rrInterval >= 300 && rrInterval <= 3000) {
          // Store RR interval
          this.rrIntervals.push(rrInterval);
          if (this.rrIntervals.length > this.MAX_RR_INTERVALS) {
            this.rrIntervals.shift();
          }
          
          // Calculate instantaneous BPM
          result.rrInterval = rrInterval;
          result.instantaneousBPM = Math.round(60000 / rrInterval);
          
          // Calculate heart rate variability if we have enough intervals
          if (this.rrIntervals.length >= 2) {
            result.heartRateVariability = this.calculateHRV();
          }
        }
      }
      
      this.lastPeakTime = timestamp;
    }
    
    return result;
  }
  
  /**
   * Update peak detection threshold adaptively
   */
  private updatePeakThreshold(): void {
    if (this.buffer.length < 10) {
      this.peakThreshold = 0.1;
      return;
    }
    
    // Calculate signal statistics
    const recentValues = this.buffer.slice(-20);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min;
    
    // Adaptive threshold based on signal range
    this.peakThreshold = min + (range * 0.6);
  }
  
  /**
   * Detect if current value is a peak
   */
  private detectPeak(value: number): boolean {
    if (this.buffer.length < 3) {
      return false;
    }
    
    const prevValue = this.buffer[this.buffer.length - 2];
    
    // Check if higher than threshold and higher than previous value
    if (value > this.peakThreshold && value > prevValue) {
      // Check if at local maximum by looking ahead
      // (This simulates checking if the next value will be lower)
      const recentTrend = this.buffer.slice(-5);
      const isLocalMaximum = recentTrend.length >= 3 && 
                           recentTrend[recentTrend.length - 1] >= recentTrend[recentTrend.length - 2];
      
      // Check minimum time between peaks (prevent double-counting)
      const minTimeBetweenPeaks = 300; // ms (200 BPM max)
      const timeCheck = this.lastPeakTime === null || 
                      (Date.now() - this.lastPeakTime) > minTimeBetweenPeaks;
      
      return isLocalMaximum && timeCheck;
    }
    
    return false;
  }
  
  /**
   * Calculate confidence in the peak detection
   */
  private calculatePeakConfidence(peakValue: number): number {
    if (this.buffer.length < 10) {
      return 0.5;
    }
    
    // Calculate peak prominence
    const recentValues = this.buffer.slice(-10);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const prominence = (peakValue - mean) / Math.max(0.0001, Math.abs(mean));
    
    // Calculate regularity if we have RR intervals
    let regularityScore = 0.5;
    if (this.rrIntervals.length >= 3) {
      const meanRR = this.rrIntervals.reduce((sum, val) => sum + val, 0) / this.rrIntervals.length;
      const rrVariations = this.rrIntervals.map(rr => Math.abs(rr - meanRR) / meanRR);
      const avgVariation = rrVariations.reduce((sum, val) => sum + val, 0) / rrVariations.length;
      
      regularityScore = Math.max(0, 1 - Math.min(1, avgVariation * 3));
    }
    
    // Combine factors for overall confidence
    const prominenceScore = Math.min(1, Math.max(0, prominence * 2));
    return (prominenceScore * 0.7) + (regularityScore * 0.3);
  }
  
  /**
   * Calculate heart rate variability (RMSSD)
   */
  private calculateHRV(): number {
    if (this.rrIntervals.length < 2) {
      return 0;
    }
    
    // Calculate successive differences
    let sumSquaredDiff = 0;
    for (let i = 1; i < this.rrIntervals.length; i++) {
      const diff = this.rrIntervals[i] - this.rrIntervals[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    // Root mean square of successive differences
    const rmssd = Math.sqrt(sumSquaredDiff / (this.rrIntervals.length - 1));
    return rmssd;
  }
  
  /**
   * Reset the processor
   */
  public reset(): void {
    this.buffer = [];
    this.timestamps = [];
    this.peakThreshold = 0.1;
    this.lastPeakTime = null;
    this.rrIntervals = [];
  }
}
