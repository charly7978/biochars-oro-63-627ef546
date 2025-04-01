/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Cardiac measurement channel
 */

import { SpecializedChannel } from './SpecializedChannel';

/**
 * Channel for processing cardiac measurements
 */
export class CardiacChannel extends SpecializedChannel {
  private lastPeakTime: number | null = null;
  private peakCount: number = 0;
  private rrIntervals: number[] = [];
  private readonly maxIntervals: number = 10;
  private lastResultBpm: number = 0;
  
  constructor() {
    super('cardiac');
  }
  
  /**
   * Process signal to derive cardiac measurements
   */
  public processSignal(signal: number): {
    bpm: number;
    rrInterval: number | null;
    isPeak: boolean;
  } {
    // Add to buffer for analysis
    this.addToBuffer(signal);
    const currentTime = Date.now();
    
    // Detect peak
    const isPeak = this.detectPeak(signal, currentTime);
    
    // Calculate BPM from RR intervals
    const bpm = this.calculateBPM();
    
    // Get most recent RR interval
    const rrInterval = this.rrIntervals.length > 0 ? 
      this.rrIntervals[this.rrIntervals.length - 1] : null;
    
    // Save result
    this.lastResultBpm = bpm;
    
    return {
      bpm,
      rrInterval,
      isPeak
    };
  }
  
  /**
   * Detect if current value is a peak
   */
  private detectPeak(value: number, timestamp: number): boolean {
    if (this.recentValues.length < 3) {
      return false;
    }
    
    const prev = this.recentValues[this.recentValues.length - 2];
    const prevPrev = this.recentValues[this.recentValues.length - 3];
    
    const isPotentialPeak = value > prev && prev >= prevPrev && value > 0.1;
    
    // Enforce minimum time between peaks (300ms)
    const minPeakInterval = 300;
    const enoughTimePassed = !this.lastPeakTime || (timestamp - this.lastPeakTime) > minPeakInterval;
    
    if (isPotentialPeak && enoughTimePassed) {
      if (this.lastPeakTime) {
        const interval = timestamp - this.lastPeakTime;
        this.rrIntervals.push(interval);
        
        // Keep interval buffer size in check
        if (this.rrIntervals.length > this.maxIntervals) {
          this.rrIntervals.shift();
        }
      }
      
      this.lastPeakTime = timestamp;
      this.peakCount++;
      return true;
    }
    
    return false;
  }
  
  /**
   * Calculate heart rate (BPM) from RR intervals
   */
  private calculateBPM(): number {
    if (this.rrIntervals.length < 2) {
      return this.lastResultBpm;
    }
    
    // Filter out outliers
    const filteredIntervals = this.filterOutliers(this.rrIntervals);
    
    if (filteredIntervals.length < 2) {
      return this.lastResultBpm;
    }
    
    // Calculate average interval
    const avgInterval = filteredIntervals.reduce((sum, interval) => sum + interval, 0) / 
                        filteredIntervals.length;
    
    // Convert to BPM (60,000 ms in a minute)
    return Math.round(60000 / avgInterval);
  }
  
  /**
   * Filter outliers using IQR method
   */
  private filterOutliers(intervals: number[]): number[] {
    if (intervals.length < 4) {
      return intervals;
    }
    
    const sorted = [...intervals].sort((a, b) => a - b);
    
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return intervals.filter(val => val >= lowerBound && val <= upperBound);
  }
  
  /**
   * Calculate quality of the cardiac measurement
   */
  public calculateQuality(signal: number): number {
    if (this.recentValues.length < 5 || this.rrIntervals.length < 3) {
      return 0.5;
    }
    
    // Calculate RR interval consistency
    const rrVariance = this.getVarianceOfArray(this.rrIntervals);
    const meanRR = this.getMeanOfArray(this.rrIntervals);
    const rrConsistency = Math.max(0, 1 - (Math.sqrt(rrVariance) / meanRR) * 2);
    
    // Signal quality factors
    const signalVariance = this.getVariance();
    const signalQuality = Math.max(0, 1 - signalVariance * 10);
    
    // Peak detection quality
    const peakQuality = Math.min(1, this.peakCount / 10);
    
    // Combined score
    return (rrConsistency * 0.5) + (signalQuality * 0.3) + (peakQuality * 0.2);
  }
  
  /**
   * Helper to get variance of an array
   */
  private getVarianceOfArray(arr: number[]): number {
    if (arr.length < 2) return 0;
    
    const mean = this.getMeanOfArray(arr);
    return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  }
  
  /**
   * Helper to get mean of an array
   */
  private getMeanOfArray(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }
  
  /**
   * Reset channel state
   */
  public override reset(): void {
    super.reset();
    this.lastPeakTime = null;
    this.peakCount = 0;
    this.rrIntervals = [];
    this.lastResultBpm = 0;
  }
}
