/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Implementation of heartbeat signal processor
 */

import { HeartbeatSignalProcessor, ProcessorOptions } from './interfaces';
import { applyAdaptiveFilter, predictNextValue } from './utils/adaptive-predictor';

/**
 * Processor for heartbeat signals
 */
export class HeartbeatProcessor implements HeartbeatSignalProcessor {
  private buffer: number[] = [];
  private timestamps: number[] = [];
  private peakBuffer: number[] = [];
  private lastPeakTime: number = 0;
  private threshold: number = 0.05;
  private adaptiveThreshold: boolean = true;
  private minPeakDistance: number = 300; // ms
  private options: ProcessorOptions = {
    adaptationRate: 0.3,
    bufferSize: 30,
    useAdaptiveThresholds: true,
    sensitivityLevel: 'medium'
  };
  private rrIntervals: number[] = [];
  private bpmHistory: number[] = [];
  private arrhythmiaCounter: number = 0;

  constructor() {
    console.log("HeartbeatProcessor initialized");
  }

  /**
   * Process a signal value to detect heartbeats
   */
  processSignal(value: number) {
    const now = Date.now();
    
    // Add to buffer
    this.buffer.push(value);
    this.timestamps.push(now);
    
    // Keep buffer at specified size
    if (this.buffer.length > this.options.bufferSize!) {
      this.buffer.shift();
      this.timestamps.shift();
    }
    
    // Detect peaks
    let isPeak = false;
    let confidence = 0;
    let instantaneousBPM = null;
    let rrInterval = null;
    
    if (this.buffer.length >= 3) {
      // Check if this is a peak
      const prev = this.buffer[this.buffer.length - 2];
      const current = value;
      const timeSinceLastPeak = now - this.lastPeakTime;
      
      // Adjust threshold if adaptive
      if (this.adaptiveThreshold && this.buffer.length > 10) {
        // Calculate adaptive threshold based on recent signal
        const recent = this.buffer.slice(-10);
        const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
        const maxVal = Math.max(...recent);
        this.threshold = mean + (maxVal - mean) * 0.3;
      }
      
      // Peak detection
      if (current > prev && 
          current > this.threshold && 
          timeSinceLastPeak > this.minPeakDistance) {
        
        isPeak = true;
        this.lastPeakTime = now;
        this.peakBuffer.push(now);
        
        // Keep peak buffer manageable
        if (this.peakBuffer.length > 10) {
          this.peakBuffer.shift();
        }
        
        // Calculate BPM if we have at least 2 peaks
        if (this.peakBuffer.length >= 2) {
          // Average RR interval
          const intervals = [];
          for (let i = 1; i < this.peakBuffer.length; i++) {
            intervals.push(this.peakBuffer[i] - this.peakBuffer[i-1]);
          }
          
          // Calculate average interval
          const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
          instantaneousBPM = Math.round(60000 / avgInterval);
          rrInterval = Math.round(avgInterval);
          
          // Store RR interval
          this.rrIntervals.push(rrInterval);
          if (this.rrIntervals.length > 8) {
            this.rrIntervals.shift();
          }
          
          // Store BPM in history
          this.bpmHistory.push(instantaneousBPM);
          if (this.bpmHistory.length > 8) {
            this.bpmHistory.shift();
          }
          
          // Set confidence based on consistency
          const stdDev = Math.sqrt(
            intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length
          );
          
          const cv = stdDev / avgInterval; // Coefficient of variation
          confidence = Math.max(0, 1 - cv);
        }
      }
    }
    
    // Calculate heart rate variability (if we have enough intervals)
    let hrv = null;
    if (this.rrIntervals.length >= 3) {
      const diffs = [];
      for (let i = 1; i < this.rrIntervals.length; i++) {
        diffs.push(Math.abs(this.rrIntervals[i] - this.rrIntervals[i-1]));
      }
      hrv = Math.sqrt(diffs.reduce((sum, val) => sum + val * val, 0) / diffs.length);
    }
    
    // Calculate average BPM from history
    const bpm = this.calculateAverageBPM();
    
    return {
      value,
      isPeak,
      confidence,
      instantaneousBPM,
      rrInterval,
      timestamp: now,
      bpm,
      heartRateVariability: hrv,
      rrData: {
        intervals: this.rrIntervals,
        lastPeakTime: this.lastPeakTime
      }
    };
  }

  /**
   * Calculate average BPM from history
   */
  private calculateAverageBPM(): number {
    if (this.bpmHistory.length === 0) return 0;
    
    // Sort to remove outliers
    const sorted = [...this.bpmHistory].sort((a, b) => a - b);
    
    // Use central 80% of the data if we have enough values
    if (sorted.length >= 5) {
      const startIdx = Math.floor(sorted.length * 0.1);
      const endIdx = Math.ceil(sorted.length * 0.9);
      const centralValues = sorted.slice(startIdx, endIdx);
      
      const sum = centralValues.reduce((a, b) => a + b, 0);
      return Math.round(sum / centralValues.length);
    }
    
    // Otherwise use simple average
    const sum = sorted.reduce((a, b) => a + b, 0);
    return Math.round(sum / sorted.length);
  }

  /**
   * Reset the processor
   */
  reset(): void {
    this.buffer = [];
    this.timestamps = [];
    this.peakBuffer = [];
    this.lastPeakTime = 0;
    this.threshold = 0.05;
    this.rrIntervals = [];
    this.bpmHistory = [];
    this.arrhythmiaCounter = 0;
    console.log("HeartbeatProcessor: Reset complete");
  }

  /**
   * Configure the processor with options
   */
  configure(options: ProcessorOptions): void {
    this.options = { ...this.options, ...options };
    
    // Update parameters based on sensitivity
    if (options.sensitivityLevel) {
      switch (options.sensitivityLevel) {
        case 'low':
          this.threshold = 0.1;
          this.minPeakDistance = 400;
          break;
        case 'medium':
          this.threshold = 0.05;
          this.minPeakDistance = 300;
          break;
        case 'high':
          this.threshold = 0.03;
          this.minPeakDistance = 250;
          break;
      }
    }
    
    this.adaptiveThreshold = !!this.options.useAdaptiveThresholds;
    
    console.log("HeartbeatProcessor: Configured with options", this.options);
  }

  /**
   * Get RR intervals data
   */
  getRRIntervals() {
    return {
      intervals: [...this.rrIntervals],
      lastPeakTime: this.lastPeakTime
    };
  }

  /**
   * Get arrhythmia counter
   */
  getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
}
