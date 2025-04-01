
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Specialized processor for cardiac measurements
 * Uses optimized cardiac signal for heart rate and arrhythmia detection
 */

import { BaseVitalSignProcessor } from './BaseVitalSignProcessor';
import { VitalSignType, ChannelFeedback } from '../../../types/signal';

/**
 * Result interface for cardiac measurements
 */
export interface CardiacResult {
  heartRate: number;
  arrhythmiaDetected: boolean;
  rhythmRegularity: number;
}

/**
 * Cardiac processor implementation
 */
export class CardiacProcessor extends BaseVitalSignProcessor<CardiacResult> {
  // Cardiac measurement parameters
  private readonly MAX_HEART_RATE = 180;  // bpm
  private readonly MIN_HEART_RATE = 40;   // bpm
  
  // Peak detection state
  private lastPeakTime: number = 0;
  private peakBuffer: number[] = [];
  private intervalBuffer: number[] = [];
  private readonly MAX_PEAK_BUFFER = 20;
  
  constructor() {
    super(VitalSignType.CARDIAC);
  }
  
  /**
   * Process a value from the cardiac-optimized channel
   * @param value Optimized cardiac signal value
   * @returns Cardiac measurement results
   */
  protected processValueImpl(value: number): CardiacResult {
    // Skip processing if the value is too small
    if (Math.abs(value) < 0.01) {
      return {
        heartRate: 0,
        arrhythmiaDetected: false,
        rhythmRegularity: 0
      };
    }
    
    // Detect peaks for heart rate calculation
    this.detectPeak(value);
    
    // Calculate heart rate from peaks
    const heartRate = this.calculateHeartRate();
    
    // Check for arrhythmia
    const { arrhythmiaDetected, rhythmRegularity } = this.detectArrhythmia();
    
    return {
      heartRate: Math.round(heartRate),
      arrhythmiaDetected,
      rhythmRegularity
    };
  }
  
  /**
   * Detect peaks in cardiac signal
   */
  private detectPeak(value: number): void {
    // Add to peak buffer
    this.peakBuffer.push(value);
    if (this.peakBuffer.length > this.MAX_PEAK_BUFFER) {
      this.peakBuffer.shift();
    }
    
    // Need at least 3 values for peak detection
    if (this.peakBuffer.length < 3) return;
    
    // Check if middle value is a peak
    const len = this.peakBuffer.length;
    if (this.peakBuffer[len-2] > this.peakBuffer[len-3] && 
        this.peakBuffer[len-2] > this.peakBuffer[len-1] &&
        this.peakBuffer[len-2] > 0.2) {
      
      // We found a peak
      const now = Date.now();
      
      // Calculate interval if we have a previous peak
      if (this.lastPeakTime > 0) {
        const interval = now - this.lastPeakTime;
        
        // Only accept physiologically plausible intervals
        if (interval > 300 && interval < 2000) {
          this.intervalBuffer.push(interval);
          if (this.intervalBuffer.length > 10) {
            this.intervalBuffer.shift();
          }
        }
      }
      
      // Update last peak time
      this.lastPeakTime = now;
    }
  }
  
  /**
   * Calculate heart rate from detected peaks
   */
  private calculateHeartRate(): number {
    if (this.intervalBuffer.length < 2) {
      return 0;
    }
    
    // Calculate average interval
    const avgInterval = this.intervalBuffer.reduce((sum, interval) => sum + interval, 0) / 
                       this.intervalBuffer.length;
    
    // Convert to BPM
    const heartRate = 60000 / avgInterval;
    
    // Ensure result is within physiological range
    return Math.min(this.MAX_HEART_RATE, Math.max(this.MIN_HEART_RATE, heartRate));
  }
  
  /**
   * Detect arrhythmia from interval pattern
   */
  private detectArrhythmia(): { arrhythmiaDetected: boolean, rhythmRegularity: number } {
    if (this.intervalBuffer.length < 3) {
      return {
        arrhythmiaDetected: false,
        rhythmRegularity: 0
      };
    }
    
    // Calculate interval variation
    const avgInterval = this.intervalBuffer.reduce((sum, interval) => sum + interval, 0) / 
                       this.intervalBuffer.length;
    
    const variance = this.intervalBuffer.reduce(
      (sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0
    ) / this.intervalBuffer.length;
    
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgInterval;
    
    // Calculate rhythm regularity (1 = perfectly regular, 0 = chaotic)
    const rhythmRegularity = Math.max(0, 1 - coefficientOfVariation * 3);
    
    // Detect arrhythmia when rhythm regularity is low
    const arrhythmiaDetected = rhythmRegularity < 0.7;
    
    return {
      arrhythmiaDetected,
      rhythmRegularity
    };
  }
  
  /**
   * Reset processor
   */
  public override reset(): void {
    super.reset();
    this.lastPeakTime = 0;
    this.peakBuffer = [];
    this.intervalBuffer = [];
  }
}
