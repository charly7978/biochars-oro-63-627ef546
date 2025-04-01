/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { ProcessedHeartbeatSignal, SignalProcessingOptions } from './types';
import { HeartbeatSignalProcessor } from './interfaces';
import { calculateEMA } from '../vital-signs/utils/statistics-utils';
import { findPeaksAndValleys } from '../vital-signs/utils/peak-detection-utils';
import { 
  applyAdaptiveFilter,
  predictNextValue,
  correctSignalAnomalies,
  updateQualityWithPrediction
} from './utils/adaptive-predictor';

/**
 * Processor for heartbeat signals
 * Direct measurement only, no simulation
 */
export class HeartbeatProcessor implements HeartbeatSignalProcessor {
  private signalBuffer: number[] = [];
  private peakBuffer: number[] = [];
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private lastProcessedValue: number = 0;
  private currentBpm: number = 0;
  private confidenceLevel: number = 0;
  private options: SignalProcessingOptions = {
    filterStrength: 0.2,
    qualityThreshold: 0.4
  };
  
  /**
   * Configure the processor with new options
   */
  configure(options: Partial<SignalProcessingOptions>): void {
    this.options = { ...this.options, ...options };
    console.log("HeartbeatProcessor: Configured with options", this.options);
  }
  
  /**
   * Process a heartbeat signal and detect peaks
   */
  processSignal(signal: number): ProcessedHeartbeatSignal {
    // Add to buffer
    this.signalBuffer.push(signal);
    
    // Keep buffer at reasonable size
    if (this.signalBuffer.length > 128) {
      this.signalBuffer.shift();
    }
    
    // Apply filtering
    const filtered = this.applyFiltering(signal);
    
    // Detect peaks
    const now = Date.now();
    let isPeak = false;
    
    if (this.signalBuffer.length >= 5) {
      // Get last few values
      const lastValues = this.signalBuffer.slice(-5);
      
      // Center value is a peak if it's the highest
      const centerValue = lastValues[2];
      const isLocalPeak = centerValue > lastValues[1] && 
                          centerValue > lastValues[3] &&
                          centerValue >= lastValues[0] &&
                          centerValue >= lastValues[4];
      
      if (isLocalPeak) {
        isPeak = true;
        this.peakBuffer.push(centerValue);
        
        // Handle timing if this is a confirmed peak
        if (this.lastPeakTime !== null) {
          this.previousPeakTime = this.lastPeakTime;
          const interval = now - this.lastPeakTime;
          
          // Only add reasonable intervals (between 40 and 200 BPM)
          if (interval >= 300 && interval <= 1500) {
            this.rrIntervals.push(interval);
            
            // Keep RR intervals buffer manageable
            if (this.rrIntervals.length > 10) {
              this.rrIntervals.shift();
            }
          }
        }
        
        this.lastPeakTime = now;
      }
    }
    
    // Calculate BPM if we have enough intervals
    if (this.rrIntervals.length >= 3) {
      const avgInterval = this.rrIntervals.reduce((sum, val) => sum + val, 0) / this.rrIntervals.length;
      const newBpm = Math.round(60000 / avgInterval);
      
      // Validate BPM is reasonable
      if (newBpm >= 40 && newBpm <= 200) {
        // Smooth BPM values
        this.currentBpm = Math.round(this.currentBpm * 0.7 + newBpm * 0.3);
        
        // Update confidence based on consistency of intervals
        const intervalDeviation = this.calculateIntervalDeviation();
        this.confidenceLevel = Math.max(0, Math.min(1, 1 - intervalDeviation / 0.3));
      }
    }
    
    // Calculate instantaneous BPM if available
    let instantBpm: number | null = null;
    if (this.previousPeakTime !== null && this.lastPeakTime !== null) {
      const lastInterval = this.lastPeakTime - this.previousPeakTime;
      if (lastInterval >= 300 && lastInterval <= 1500) {
        instantBpm = Math.round(60000 / lastInterval);
      }
    }
    
    // Calculate heart rate variability if possible
    let hrv: number | null = null;
    if (this.rrIntervals.length >= 5) {
      hrv = this.calculateRMSSD();
    }
    
    // Store this value
    this.lastProcessedValue = filtered;
    
    return {
      timestamp: now,
      value: filtered,
      isPeak,
      bpm: this.currentBpm,
      rrInterval: this.rrIntervals.length > 0 ? this.rrIntervals[this.rrIntervals.length - 1] : null,
      confidence: this.confidenceLevel,
      instantaneousBPM: instantBpm,
      heartRateVariability: hrv,
      rrData: {
        intervals: [...this.rrIntervals],
        lastPeakTime: this.lastPeakTime
      }
    };
  }
  
  /**
   * Reset the processor state
   */
  reset(): void {
    this.signalBuffer = [];
    this.peakBuffer = [];
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastProcessedValue = 0;
    this.currentBpm = 0;
    this.confidenceLevel = 0;
    console.log("HeartbeatProcessor: Reset complete");
  }
  
  /**
   * Apply filtering to the input signal
   */
  private applyFiltering(signal: number): number {
    if (this.signalBuffer.length < 3) return signal;
    
    // Apply adaptive filter
    return applyAdaptiveFilter(signal, this.signalBuffer, this.options.filterStrength);
  }
  
  /**
   * Calculate RMSSD (Root Mean Square of Successive Differences)
   * A common HRV metric
   */
  private calculateRMSSD(): number {
    if (this.rrIntervals.length < 2) return 0;
    
    let sumSquaredDiffs = 0;
    for (let i = 1; i < this.rrIntervals.length; i++) {
      const diff = this.rrIntervals[i] - this.rrIntervals[i-1];
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiffs / (this.rrIntervals.length - 1));
  }
  
  /**
   * Calculate the variability in RR intervals
   */
  private calculateIntervalDeviation(): number {
    if (this.rrIntervals.length < 2) return 1;
    
    const avgInterval = this.rrIntervals.reduce((sum, val) => sum + val, 0) / this.rrIntervals.length;
    const deviations = this.rrIntervals.map(interval => Math.abs(interval - avgInterval) / avgInterval);
    
    return deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
  }
}
