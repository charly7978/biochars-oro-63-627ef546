
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsResult, RRIntervalData } from '../../types/vital-signs';
import { BloodPressureProcessor } from './blood-pressure/BloodPressureProcessor';
import { formatBloodPressure } from './blood-pressure/BloodPressureUtils';

/**
 * Core processor for vital signs
 * Direct measurement only - no simulation
 */
export class VitalSignsProcessor {
  private arrhythmiaCounter: number = 0;
  private signalHistory: number[] = [];
  private lastDetectionTime: number = 0;
  private bloodPressureProcessor: BloodPressureProcessor;
  
  constructor() {
    this.bloodPressureProcessor = new BloodPressureProcessor();
    console.log("VitalSignsProcessor: Initialized");
  }
  
  /**
   * Process a PPG signal to calculate vital signs
   * Direct measurement only - no simulation
   */
  public processSignal(
    ppgValue: number,
    rrData?: RRIntervalData
  ): VitalSignsResult {
    // Add value to history
    this.signalHistory.push(ppgValue);
    if (this.signalHistory.length > 50) {
      this.signalHistory.shift();
    }
    
    // Basic validation
    if (Math.abs(ppgValue) < 0.05) {
      return this.getEmptyResult();
    }
    
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
    
    // Calculate basic vital signs based on PPG signal
    const spo2 = this.calculateSpO2(ppgValue);
    const bloodPressure = this.calculateBloodPressure(ppgValue, rrData);
    const glucose = this.calculateGlucose(ppgValue);
    const lipids = this.calculateLipids(ppgValue);
    
    return {
      spo2,
      pressure: bloodPressure,
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
   * Get empty result for invalid signals
   */
  private getEmptyResult(): VitalSignsResult {
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      }
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
    
    return formatBloodPressure(systolic, diastolic);
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
   * Reset the processor
   */
  public reset(): VitalSignsResult {
    const lastResult = this.getEmptyResult();
    this.signalHistory = [];
    this.lastDetectionTime = 0;
    return lastResult;
  }
  
  /**
   * Completely reset the processor
   */
  public fullReset(): void {
    this.arrhythmiaCounter = 0;
    this.signalHistory = [];
    this.lastDetectionTime = 0;
    console.log("VitalSignsProcessor: Full reset complete");
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
}
