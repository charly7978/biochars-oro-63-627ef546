
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Specialized channel for cardiac signal processing
 */

import { SpecializedChannel, VitalSignType } from './SpecializedChannel';
import { applyAdaptiveFilter } from '../utils/adaptive-predictor';
import { CardiacResult } from '../interfaces';

export class CardiacChannel extends SpecializedChannel {
  private cardiacBuffer: number[] = [];
  private peakTimes: number[] = [];
  private lastPeakTime: number | null = null;
  private lastResult: CardiacResult = {
    bpm: 0,
    confidence: 0,
    isPeak: false,
    rrInterval: null,
    hrv: null
  };
  
  // HRV calculation
  private rrIntervals: number[] = [];
  private lastBeatTime: number = 0;
  
  constructor(id?: string) {
    super(VitalSignType.CARDIAC, id);
  }

  /**
   * Process a signal value to cardiac metrics
   */
  processValue(signal: number): CardiacResult {
    // Add to buffer
    this.cardiacBuffer.push(signal);
    this.addValue(signal);
    
    if (this.cardiacBuffer.length > 30) {
      this.cardiacBuffer.shift();
    }
    
    // Apply adaptive filtering
    let filteredValue = signal;
    if (this.cardiacBuffer.length >= 5) {
      filteredValue = applyAdaptiveFilter(signal, this.cardiacBuffer, 0.4);
    }
    
    // Detect peaks in the signal
    const isPeak = this.detectPeak(filteredValue);
    
    // Calculate heart rate if peak detected
    if (isPeak) {
      const now = Date.now();
      this.peakTimes.push(now);
      
      if (this.peakTimes.length > 10) {
        this.peakTimes.shift();
      }
      
      if (this.lastPeakTime !== null) {
        const rrInterval = now - this.lastPeakTime;
        
        // Only consider reasonable RR intervals (30-240 BPM range)
        if (rrInterval >= 250 && rrInterval <= 2000) {
          this.rrIntervals.push(rrInterval);
          
          if (this.rrIntervals.length > 8) {
            this.rrIntervals.shift();
          }
          
          this.lastResult.rrInterval = rrInterval;
          
          // Calculate instantaneous BPM
          const instantBPM = 60000 / rrInterval;
          
          // Average the last few BPM values for stability
          const averageBPM = this.calculateAverageBPM();
          
          // Only update if the value is reasonable
          if (averageBPM >= 30 && averageBPM <= 240) {
            this.lastResult.bpm = Math.round(averageBPM);
          }
          
          // Calculate HRV (RMSSD)
          this.lastResult.hrv = this.calculateHRV();
          
          // High confidence since we detected a peak
          this.lastResult.confidence = 0.9;
        }
      }
      
      this.lastPeakTime = now;
    } else {
      // Slowly decay confidence if no peaks for a while
      if (this.lastPeakTime && Date.now() - this.lastPeakTime > 2000) {
        this.lastResult.confidence = Math.max(0, this.lastResult.confidence - 0.1);
      }
    }
    
    // Update result
    this.lastResult.isPeak = isPeak;
    
    return { ...this.lastResult };
  }

  /**
   * Simple peak detection algorithm
   */
  private detectPeak(value: number): boolean {
    if (this.cardiacBuffer.length < 5) return false;
    
    // Get recent values
    const recent = this.cardiacBuffer.slice(-5);
    const current = recent[4]; // Current value
    const previous = recent.slice(0, 4);
    
    // Check if current is highest in the recent window
    const isHighest = previous.every(v => current > v);
    
    // Need minimum amplitude for a valid peak
    const min = Math.min(...previous);
    const amplitude = current - min;
    const hasMinimumAmplitude = amplitude > 0.15;
    
    // Timing constraint - don't detect peaks too close together
    const now = Date.now();
    const minPeakInterval = 250; // Minimum 250ms between peaks (240 BPM max)
    const hasValidTiming = !this.lastPeakTime || 
                          (now - this.lastPeakTime) > minPeakInterval;
    
    return isHighest && hasMinimumAmplitude && hasValidTiming;
  }

  /**
   * Calculate average BPM over the recent peaks
   */
  private calculateAverageBPM(): number {
    if (this.peakTimes.length < 2) return 0;
    
    // Calculate average interval
    let totalInterval = 0;
    let intervalCount = 0;
    
    for (let i = 1; i < this.peakTimes.length; i++) {
      const interval = this.peakTimes[i] - this.peakTimes[i-1];
      
      // Only consider reasonable intervals
      if (interval >= 250 && interval <= 2000) {
        totalInterval += interval;
        intervalCount++;
      }
    }
    
    if (intervalCount === 0) return 0;
    
    const avgInterval = totalInterval / intervalCount;
    return 60000 / avgInterval; // Convert to BPM
  }

  /**
   * Calculate heart rate variability (RMSSD)
   */
  private calculateHRV(): number {
    if (this.rrIntervals.length < 2) return 0;
    
    // Calculate successive differences
    let sumSquaredDiffs = 0;
    
    for (let i = 1; i < this.rrIntervals.length; i++) {
      const diff = this.rrIntervals[i] - this.rrIntervals[i-1];
      sumSquaredDiffs += diff * diff;
    }
    
    // Calculate RMSSD
    const rmssd = Math.sqrt(sumSquaredDiffs / (this.rrIntervals.length - 1));
    return rmssd;
  }

  /**
   * Reset the channel
   */
  reset(): void {
    super.reset();
    this.cardiacBuffer = [];
    this.peakTimes = [];
    this.lastPeakTime = null;
    this.rrIntervals = [];
    this.lastBeatTime = 0;
    this.lastResult = {
      bpm: 0,
      confidence: 0,
      isPeak: false,
      rrInterval: null,
      hrv: null
    };
  }

  /**
   * Get the current cardiac result
   */
  getLastResult(): CardiacResult {
    return { ...this.lastResult };
  }
  
  /**
   * Get the current heart rate
   */
  getBPM(): number {
    return this.lastResult.bpm;
  }
  
  /**
   * Get the latest RR interval
   */
  getLastRRInterval(): number | null {
    return this.lastResult.rrInterval;
  }
  
  /**
   * Get the heart rate variability
   */
  getHRV(): number | null {
    return this.lastResult.hrv;
  }
}
