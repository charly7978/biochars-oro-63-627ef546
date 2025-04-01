
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Implementation of heartbeat signal processor
 */

import { ProcessedHeartbeatSignal, SignalProcessingOptions, SignalProcessor } from './types';
import { validateMultiBeatSequence } from '../vital-signs/enhanced-detection/multi-beat-validator';
import { findPeaksFourier } from '../vital-signs/enhanced-detection/fourier-analyzer';
import { getAdaptiveThreshold } from '../vital-signs/enhanced-detection/adaptive-threshold';
import {
  applyAdaptiveFilter,
  predictNextValue,
  correctSignalAnomalies,
  updateQualityWithPrediction
} from './utils/adaptive-predictor';

/**
 * Processes PPG signals to detect heartbeats
 */
export class HeartbeatProcessor implements SignalProcessor {
  private options: SignalProcessingOptions = {
    adaptiveFiltering: true,
    amplificationFactor: 3.0,
    useAdaptiveControl: true,
    qualityEnhancedByPrediction: true
  };
  
  private valueBuffer: number[] = [];
  private timeBuffer: number[] = [];
  private peakIndices: number[] = [];
  private peakTimes: number[] = [];
  private maxBufferSize: number = 150;
  private lastPeakIndex: number = -1;
  private lastRR: number | null = null;
  private recentRRs: number[] = [];
  private adaptiveThreshold: number = 0.1;
  private currentBPM: number = 0;
  private currentConfidence: number = 0;
  private lastTimestamp: number = 0;
  
  /**
   * Process a heartbeat signal
   */
  processSignal(value: number): ProcessedHeartbeatSignal {
    const timestamp = Date.now();
    const timeDelta = this.lastTimestamp > 0 ? (timestamp - this.lastTimestamp) / 1000 : 0.033;
    this.lastTimestamp = timestamp;
    
    // Apply adaptive filtering if enabled
    let processedValue = value;
    if (this.options.useAdaptiveControl) {
      processedValue = applyAdaptiveFilter(value, this.valueBuffer, this.options);
    }
    
    // Add to buffer
    this.valueBuffer.push(processedValue);
    this.timeBuffer.push(timestamp);
    
    // Maintain buffer size
    if (this.valueBuffer.length > this.maxBufferSize) {
      this.valueBuffer.shift();
      this.timeBuffer.shift();
    }
    
    // Not enough data for peak detection
    if (this.valueBuffer.length < 10) {
      return {
        timestamp,
        value: processedValue,
        isPeak: false,
        bpm: 0,
        rrInterval: null,
        confidence: 0,
        instantaneousBPM: null,
        heartRateVariability: null
      };
    }
    
    // Use adaptive threshold for peak detection
    this.adaptiveThreshold = getAdaptiveThreshold(
      this.valueBuffer.slice(-30),
      this.adaptiveThreshold
    );
    
    // Detect peaks using Fourier analysis for improved detection
    let isPeak = false;
    if (this.valueBuffer.length >= 30) {
      // Use recent window for peak detection
      const recentValues = this.valueBuffer.slice(-30);
      const newPeakIndices = findPeaksFourier(recentValues);
      
      // Check if the latest value is a peak
      if (newPeakIndices.includes(recentValues.length - 1)) {
        isPeak = true;
        this.peakIndices.push(this.valueBuffer.length - 1);
        this.peakTimes.push(timestamp);
        
        // Calculate RR interval
        if (this.peakTimes.length > 1) {
          const lastIdx = this.peakTimes.length - 1;
          const rr = (this.peakTimes[lastIdx] - this.peakTimes[lastIdx - 1]) / 1000; // in seconds
          
          // Store RR interval
          this.lastRR = rr;
          this.recentRRs.push(rr);
          if (this.recentRRs.length > 8) {
            this.recentRRs.shift();
          }
        }
      }
    } else {
      // Fallback to simple threshold for small buffers
      const lastValue = this.valueBuffer[this.valueBuffer.length - 1];
      const prevValue = this.valueBuffer[this.valueBuffer.length - 2] || 0;
      const nextValuePrediction = predictNextValue(this.valueBuffer, this.options);
      
      isPeak = lastValue > this.adaptiveThreshold && 
               lastValue > prevValue && 
               lastValue > (nextValuePrediction * 0.9);
      
      if (isPeak) {
        this.peakIndices.push(this.valueBuffer.length - 1);
        this.peakTimes.push(timestamp);
        
        // Calculate RR interval
        if (this.peakTimes.length > 1) {
          const lastIdx = this.peakTimes.length - 1;
          const rr = (this.peakTimes[lastIdx] - this.peakTimes[lastIdx - 1]) / 1000; // in seconds
          
          // Store RR interval
          this.lastRR = rr;
          this.recentRRs.push(rr);
          if (this.recentRRs.length > 8) {
            this.recentRRs.shift();
          }
        }
      }
    }
    
    // Calculate BPM from RR intervals
    let instantaneousBPM: number | null = null;
    let hrv: number | null = null;
    
    if (this.recentRRs.length > 0) {
      // Calculate average RR interval, ignoring outliers
      const sortedRRs = [...this.recentRRs].sort((a, b) => a - b);
      const medianRR = sortedRRs[Math.floor(sortedRRs.length / 2)];
      
      // Filter out extreme outliers
      const validRRs = this.recentRRs.filter(rr => 
        rr >= medianRR * 0.7 && rr <= medianRR * 1.3
      );
      
      if (validRRs.length > 0) {
        const avgRR = validRRs.reduce((sum, rr) => sum + rr, 0) / validRRs.length;
        const bpm = Math.round(60 / avgRR);
        
        // Only accept physiologically plausible values
        if (bpm >= 40 && bpm <= 200) {
          this.currentBPM = bpm;
          
          // Calculate instantaneous BPM
          if (this.lastRR !== null) {
            instantaneousBPM = Math.round(60 / this.lastRR);
          }
          
          // Calculate heart rate variability (standard deviation of RR intervals)
          if (validRRs.length >= 3) {
            const mean = validRRs.reduce((sum, rr) => sum + rr, 0) / validRRs.length;
            const variance = validRRs.reduce((sum, rr) => sum + Math.pow(rr - mean, 2), 0) / validRRs.length;
            hrv = Math.sqrt(variance) * 1000; // Convert to ms
          }
        }
      }
    }
    
    // Validate peaks using multi-beat sequence validation
    if (this.peakIndices.length >= 3) {
      const validation = validateMultiBeatSequence(this.peakIndices, this.valueBuffer);
      this.currentConfidence = validation.confidence;
    }
    
    return {
      timestamp,
      value: processedValue,
      isPeak,
      bpm: this.currentBPM,
      rrInterval: this.lastRR,
      confidence: this.currentConfidence,
      instantaneousBPM,
      heartRateVariability: hrv
    };
  }
  
  /**
   * Reset processor state
   */
  reset(): void {
    this.valueBuffer = [];
    this.timeBuffer = [];
    this.peakIndices = [];
    this.peakTimes = [];
    this.lastPeakIndex = -1;
    this.lastRR = null;
    this.recentRRs = [];
    this.adaptiveThreshold = 0.1;
    this.currentBPM = 0;
    this.currentConfidence = 0;
    this.lastTimestamp = 0;
  }
  
  /**
   * Configure the processor
   */
  configure(options: Partial<SignalProcessingOptions>): void {
    if (options.amplificationFactor !== undefined) {
      this.options.amplificationFactor = options.amplificationFactor;
    }
    
    if (options.useAdaptiveControl !== undefined) {
      this.options.useAdaptiveControl = options.useAdaptiveControl;
    }
    
    if (options.qualityEnhancedByPrediction !== undefined) {
      this.options.qualityEnhancedByPrediction = options.qualityEnhancedByPrediction;
    }
    
    if (options.adaptiveFiltering !== undefined) {
      this.options.adaptiveFiltering = options.adaptiveFiltering;
    }
  }
}
