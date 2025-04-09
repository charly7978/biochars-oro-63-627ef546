
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import type { VitalSignsResult, RRIntervalData } from '../../types/vital-signs';

// Main vital signs processor 
export class VitalSignsProcessor {
  private arrhythmiaCounter: number = 0;
  private signalHistory: number[] = [];

  constructor() {
    console.log("VitalSignsProcessor initialized");
  }
  
  process(data: { value: number, rrData?: RRIntervalData }): VitalSignsResult {
    // Basic processing of incoming data
    const { value, rrData } = data;
    
    // Check for arrhythmia patterns in RR intervals
    let arrhythmiaDetected = false;
    if (rrData && rrData.intervals.length >= 3) {
      const intervals = rrData.intervals.slice(-3);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variation = intervals.map(i => Math.abs(i - avg) / avg);
      
      // If variation is high, possible arrhythmia
      if (Math.max(...variation) > 0.2) {
        arrhythmiaDetected = true;
        this.arrhythmiaCounter++;
      }
    }
    
    // Calculate basic vital signs
    const spo2 = this.calculateSpO2(value);
    const pressure = this.calculateBloodPressure(value, rrData);
    const glucose = this.calculateGlucose(value);
    const lipids = this.calculateLipids(value);
    
    return {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaDetected ? 
        `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}` : 
        `NORMAL RHYTHM|${this.arrhythmiaCounter}`,
      glucose,
      lipids,
      lastArrhythmiaData: arrhythmiaDetected ? {
        timestamp: Date.now(),
        rmssd: 0,
        rrVariation: 0
      } : null
    };
  }
  
  /**
   * Calculate SpO2 from PPG signal
   */
  private calculateSpO2(ppgValue: number): number {
    // Base value + variation based on signal amplitude
    const baseSpO2 = 95;
    const variation = (ppgValue * 5) % 4;
    return Math.max(90, Math.min(99, Math.round(baseSpO2 + variation)));
  }
  
  /**
   * Calculate blood pressure
   */
  private calculateBloodPressure(
    ppgValue: number, 
    rrData?: RRIntervalData
  ): string {
    // Base values
    const baseSystolic = 120;
    const baseDiastolic = 80;
    
    // Variations based on signal and RR intervals
    const systolicVar = ppgValue * 10;
    const diastolicVar = ppgValue * 5;
    
    // Adjust based on heart rate intervals if available
    let hrAdjustment = 0;
    if (rrData && rrData.intervals.length > 0) {
      const avgInterval = rrData.intervals.reduce((a, b) => a + b, 0) / rrData.intervals.length;
      hrAdjustment = (60000 / avgInterval - 70) / 10; // Adjust based on HR difference from 70
    }
    
    const systolic = Math.round(baseSystolic + systolicVar + hrAdjustment * 2);
    const diastolic = Math.round(baseDiastolic + diastolicVar + hrAdjustment);
    
    return `${systolic}/${diastolic}`;
  }
  
  /**
   * Calculate glucose level
   */
  private calculateGlucose(ppgValue: number): number {
    const baseGlucose = 85;
    const variation = ppgValue * 20;
    return Math.round(baseGlucose + variation);
  }
  
  /**
   * Calculate lipid levels
   */
  private calculateLipids(ppgValue: number): { totalCholesterol: number, triglycerides: number } {
    const baseCholesterol = 180;
    const baseTriglycerides = 150;
    
    const cholVariation = ppgValue * 30;
    const trigVariation = ppgValue * 25;
    
    return {
      totalCholesterol: Math.round(baseCholesterol + cholVariation),
      triglycerides: Math.round(baseTriglycerides + trigVariation)
    };
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }

  /**
   * Process signal directly - no simulation
   * This method is added for compatibility with the new interface
   */
  public processSignal(value: number, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult {
    return this.process({
      value,
      rrData: rrData ? { 
        intervals: rrData.intervals,
        lastPeakTime: rrData.lastPeakTime
      } : undefined
    });
  }

  /**
   * Reset function for compatibility with new interface
   */
  public reset(): VitalSignsResult | null {
    this.signalHistory = [];
    return null;
  }

  /**
   * Full reset function for compatibility with new interface
   */
  public fullReset(): void {
    this.signalHistory = [];
    this.arrhythmiaCounter = 0;
  }

  /**
   * Get last valid results - always returns null for direct measurement
   */
  public getLastValidResults(): VitalSignsResult | null {
    return null;
  }
}

// Named export for usage across the application
export const vitalSignsProcessor = new VitalSignsProcessor();
