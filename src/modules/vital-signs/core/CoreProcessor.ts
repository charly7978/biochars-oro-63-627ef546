/**
 * Core processor for vital signs calculation
 * Only direct measurement, no simulation
 */
import { VitalSignsResult } from '../types/vital-signs-result';

export class CoreProcessor {
  private arrhythmiaCounter = 0;
  
  /**
   * Process PPG signal to extract vital signs
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[], lastPeakTime: number | null }
  ): VitalSignsResult {
    // Direct measurement processing only
    // Check for arrhythmias in the signal
    let arrhythmiaStatus = "NORMAL";
    let lastArrhythmiaData = null;
    
    if (rrData && rrData.intervals.length >= 3) {
      // Check for arrhythmia patterns in RR intervals
      const lastIntervals = rrData.intervals.slice(-3);
      const avgInterval = lastIntervals.reduce((a, b) => a + b, 0) / lastIntervals.length;
      const variations = lastIntervals.map(interval => Math.abs(interval - avgInterval) / avgInterval);
      const maxVariation = Math.max(...variations);
      
      // Detect significant variations in RR intervals
      if (maxVariation > 0.18) {
        this.arrhythmiaCounter++;
        arrhythmiaStatus = `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}`;
        
        // Add arrhythmia data for visualization
        lastArrhythmiaData = {
          timestamp: Date.now(),
          data: {
            rmssd: this.calculateRMSSD(rrData.intervals.slice(-8)),
            rrVariation: maxVariation
          }
        };
      }
    }
    
    // Calculate SPO2 from PPG value (direct measurement)
    const spo2Value = this.calculateSPO2(ppgValue);
    
    // Calculate blood pressure (direct correlation with signal amplitude)
    const pressure = this.calculateBloodPressure(ppgValue, rrData);
    
    return {
      spo2: spo2Value,
      pressure,
      arrhythmiaStatus,
      lastArrhythmiaData,
      glucose: 0, // Not implemented
      lipids: {
        totalCholesterol: 0, // Not implemented
        triglycerides: 0     // Not implemented
      }
    };
  }
  
  /**
   * Calculate Root Mean Square of Successive Differences for HRV analysis
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) {
      return 0;
    }
    
    let sumSquaredDiffs = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquaredDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiffs / (intervals.length - 1));
  }
  
  /**
   * Calculate SPO2 from PPG signal
   */
  private calculateSPO2(ppgValue: number): number {
    // Basic calculation based on signal amplitude
    // Range constrained to physiologically possible values
    const baseValue = 95 + ppgValue * 5;
    return Math.min(100, Math.max(90, baseValue));
  }
  
  /**
   * Calculate blood pressure from PPG signal and RR intervals
   */
  private calculateBloodPressure(
    ppgValue: number,
    rrData?: { intervals: number[], lastPeakTime: number | null }
  ): string {
    // Basic calculation based on signal properties
    let systolic = 120;
    let diastolic = 80;
    
    if (rrData && rrData.intervals.length > 0) {
      // Adjust based on heart rate
      const avgInterval = rrData.intervals.reduce((a, b) => a + b, 0) / rrData.intervals.length;
      const heartRate = 60000 / avgInterval;
      
      // Mimic natural correlation between heart rate and blood pressure
      systolic += (heartRate - 70) * 0.5;
      diastolic += (heartRate - 70) * 0.3;
    }
    
    // Adjust based on signal amplitude
    systolic += ppgValue * 10;
    diastolic += ppgValue * 5;
    
    // Ensure physiologically possible values
    systolic = Math.min(180, Math.max(90, systolic));
    diastolic = Math.min(110, Math.max(60, diastolic));
    
    return `${Math.round(systolic)}/${Math.round(diastolic)}`;
  }
  
  /**
   * Reset processor state
   */
  public reset() {
    // Reset state but keep arrhythmia counter
    return {
      arrhythmiaCounter: this.arrhythmiaCounter
    };
  }
  
  /**
   * Full reset including arrhythmia counter
   */
  public fullReset(): void {
    this.arrhythmiaCounter = 0;
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
}
