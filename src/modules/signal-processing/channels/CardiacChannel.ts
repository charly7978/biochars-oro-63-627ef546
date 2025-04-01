/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Specialized channel for cardiac signal processing
 */

import { SpecializedChannel, VitalSignType } from './SpecializedChannel';
import { applyAdaptiveFilter } from '../utils/adaptive-predictor';

export interface CardiacResult {
  bpm: number;
  arrhythmiaStatus: string;
  rmssd?: number;
  rrVariation?: number;
}

export class CardiacChannel extends SpecializedChannel {
  private cardiacBuffer: number[] = [];
  private peakTimes: number[] = [];
  private lastPeakTime: number = 0;
  private lastResult: CardiacResult = { 
    bpm: 0, 
    arrhythmiaStatus: "--" 
  };
  private arrhythmiaCount: number = 0;
  private consecutiveNormalBeats: number = 0;
  
  constructor(id?: string) {
    super(VitalSignType.CARDIAC, id);
  }

  /**
   * Process a cardiac signal
   */
  processValue(signal: number): CardiacResult {
    // Add to buffer
    this.cardiacBuffer.push(signal);
    if (this.cardiacBuffer.length > 30) {
      this.cardiacBuffer.shift();
    }
    
    // Filter signal
    let processedValue = signal;
    if (this.cardiacBuffer.length >= 5) {
      processedValue = applyAdaptiveFilter(signal, this.cardiacBuffer, 0.3);
    }
    
    // Process cardiac data
    this.processCardiacData(processedValue);
    
    return this.lastResult;
  }

  /**
   * Process cardiac data and update result
   */
  private processCardiacData(value: number): void {
    const now = Date.now();
    
    // Check if this is a peak
    let isPeak = false;
    if (this.cardiacBuffer.length >= 5) {
      const recent = this.cardiacBuffer.slice(-5);
      const midIndex = Math.floor(recent.length / 2);
      
      isPeak = recent.every((v, i) => {
        if (i === midIndex) return true;
        return recent[midIndex] > v;
      });
      
      // Ensure minimum peak interval (250ms) to prevent double-counting
      if (isPeak && now - this.lastPeakTime < 250) {
        isPeak = false;
      }
    }
    
    // If peak detected, calculate heart rate and arrhythmia metrics
    if (isPeak) {
      this.lastPeakTime = now;
      this.peakTimes.push(now);
      
      // Keep reasonable history
      if (this.peakTimes.length > 10) {
        this.peakTimes.shift();
      }
      
      // Calculate BPM
      if (this.peakTimes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < this.peakTimes.length; i++) {
          intervals.push(this.peakTimes[i] - this.peakTimes[i-1]);
        }
        
        // Calculate average interval
        const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
        const bpm = Math.round(60000 / avgInterval);
        
        // Only accept physiologically plausible values
        if (bpm >= 40 && bpm <= 200) {
          // Calculate RMSSD for arrhythmia detection
          let rmssd = 0;
          let rrVariation = 0;
          
          if (intervals.length >= 2) {
            const differences = [];
            for (let i = 1; i < intervals.length; i++) {
              differences.push(intervals[i] - intervals[i-1]);
            }
            
            // Calculate RMSSD
            const squaredDiffs = differences.map(d => d * d);
            const meanSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / squaredDiffs.length;
            rmssd = Math.sqrt(meanSquaredDiff);
            
            // Calculate RR variation as coefficient of variation
            const rrStd = Math.sqrt(
              intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length
            );
            rrVariation = (rrStd / avgInterval) * 100;
            
            // Check for arrhythmia
            const hasArrhythmia = this.detectArrhythmia(rmssd, rrVariation);
            
            if (hasArrhythmia) {
              this.arrhythmiaCount++;
              this.consecutiveNormalBeats = 0;
            } else {
              this.consecutiveNormalBeats++;
              // Reset arrhythmia count after significant normal beats
              if (this.consecutiveNormalBeats > 20) {
                this.arrhythmiaCount = 0;
              }
            }
          }
          
          // Update result
          this.lastResult = {
            bpm,
            arrhythmiaStatus: this.getArrhythmiaStatus(),
            rmssd,
            rrVariation
          };
        }
      }
    }
  }

  /**
   * Detect arrhythmia based on HRV metrics
   */
  private detectArrhythmia(rmssd: number, rrVariation: number): boolean {
    // Direct measurement metrics only - no simulation
    const highRMSSD = rmssd > 50;
    const highVariation = rrVariation > 15;
    
    return highRMSSD && highVariation;
  }

  /**
   * Get formatted arrhythmia status
   */
  private getArrhythmiaStatus(): string {
    if (this.lastResult.bpm === 0) {
      return "--";
    }
    
    let status = "Normal";
    if (this.arrhythmiaCount > 0) {
      status = "Detected";
    }
    
    return `${status}|${this.arrhythmiaCount}`;
  }

  /**
   * Reset the channel
   */
  reset(): void {
    super.reset();
    this.cardiacBuffer = [];
    this.peakTimes = [];
    this.lastPeakTime = 0;
    this.lastResult = { bpm: 0, arrhythmiaStatus: "--" };
    this.arrhythmiaCount = 0;
    this.consecutiveNormalBeats = 0;
  }
}
