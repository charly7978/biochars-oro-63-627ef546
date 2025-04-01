
/**
 * Specialized channel for cardiac processing
 */
import { SpecializedChannel } from './SpecializedChannel';

export class CardiacChannel extends SpecializedChannel {
  private bpm: number = 0;
  private rrIntervals: number[] = [];
  private hrv: number = 0;
  private arrhythmiaDetected: boolean = false;
  private arrhythmiaCount: number = 0;
  private confidence: number = 0;
  private lastCalculation: number = 0;
  private peaks: number[] = [];
  
  constructor() {
    super('cardiac');
  }
  
  protected processBuffer(): void {
    if (this.buffer.length < 20) {
      return;
    }
    
    const now = Date.now();
    // Only recalculate every 1 second
    if (now - this.lastCalculation < 1000) {
      return;
    }
    
    // Find peaks in the buffer
    this.findPeaks();
    
    // Calculate BPM based on peaks
    if (this.peaks.length >= 2) {
      const intervals = [];
      for (let i = 1; i < this.peaks.length; i++) {
        intervals.push(this.peaks[i] - this.peaks[i - 1]);
      }
      
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      this.bpm = Math.round(60000 / avgInterval); // Convert ms to BPM
      
      // Store RR intervals
      this.rrIntervals = intervals.slice(-10);
      
      // Calculate HRV (simple RMSSD method)
      if (intervals.length >= 2) {
        let sumSquaredDiffs = 0;
        for (let i = 1; i < intervals.length; i++) {
          const diff = intervals[i] - intervals[i - 1];
          sumSquaredDiffs += diff * diff;
        }
        this.hrv = Math.sqrt(sumSquaredDiffs / (intervals.length - 1));
        
        // Check for arrhythmia
        const threshold = 0.2; // 20% variation
        const hasArrhythmia = intervals.some(interval => {
          const variation = Math.abs(interval - avgInterval) / avgInterval;
          return variation > threshold;
        });
        
        if (hasArrhythmia && !this.arrhythmiaDetected) {
          this.arrhythmiaCount++;
        }
        
        this.arrhythmiaDetected = hasArrhythmia;
      }
    }
    
    this.confidence = 0.7 + (this.peaks.length / 100); // Higher confidence with more peaks
    this.lastCalculation = now;
  }
  
  /**
   * Find peaks in the signal buffer
   */
  private findPeaks(): void {
    const recentBuffer = this.buffer.slice(-60); // Last 60 samples
    const peaks = [];
    
    if (recentBuffer.length < 3) {
      return;
    }
    
    // Simple peak detection
    for (let i = 1; i < recentBuffer.length - 1; i++) {
      if (recentBuffer[i] > recentBuffer[i - 1] && 
          recentBuffer[i] > recentBuffer[i + 1] &&
          recentBuffer[i] > 0.5) { // Threshold
        peaks.push(this.lastProcessingTime - (recentBuffer.length - i) * 1000 / 30); // Approximate timestamp
      }
    }
    
    this.peaks = peaks;
  }
  
  public getResults(): { 
    bpm: number; 
    rrIntervals: number[]; 
    hrv: number; 
    arrhythmiaDetected: boolean;
    arrhythmiaCount: number;
    confidence: number 
  } {
    return {
      bpm: this.bpm,
      rrIntervals: this.rrIntervals,
      hrv: this.hrv,
      arrhythmiaDetected: this.arrhythmiaDetected,
      arrhythmiaCount: this.arrhythmiaCount,
      confidence: Math.min(0.95, this.confidence)
    };
  }
  
  protected resetChannel(): void {
    this.bpm = 0;
    this.rrIntervals = [];
    this.hrv = 0;
    this.arrhythmiaDetected = false;
    this.confidence = 0;
    this.lastCalculation = 0;
    this.peaks = [];
  }
}
