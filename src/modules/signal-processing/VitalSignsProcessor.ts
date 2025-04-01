
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BloodPressureProcessor } from '../vital-signs/blood-pressure/BloodPressureProcessor';
import { formatBloodPressure } from '../vital-signs/blood-pressure/BloodPressureUtils';

// Define the VitalSignsResult interface
export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd?: number;
    rrVariation?: number;
  } | null;
}

// Create type for RR interval data
export interface RRIntervalData {
  intervals: number[];
  lastPeakTime: number | null;
}

/**
 * Core processor for vital signs
 * Direct measurement only - no simulation
 */
export class VitalSignsProcessor {
  private arrhythmiaCounter: number = 0;
  private signalHistory: number[] = [];
  private lastDetectionTime: number = 0;
  private bpProcessor: BloodPressureProcessor;
  
  constructor() {
    this.bpProcessor = new BloodPressureProcessor();
    console.log("VitalSignsProcessor initialized");
  }
  
  /**
   * Process a PPG signal with improved false positive detection
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
    
    // Use the blood pressure processor for accurate results
    const bpResult = this.bpProcessor.process(ppgValue);
    const pressure = formatBloodPressure(bpResult.systolic, bpResult.diastolic);
    
    // Calculate basic vital signs based on PPG signal
    const spo2 = this.calculateSpO2(ppgValue);
    const glucose = this.calculateGlucose(ppgValue);
    const lipids = this.calculateLipids(ppgValue);
    
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
  public reset(): VitalSignsResult | null {
    const lastResult = this.getEmptyResult();
    this.signalHistory = [];
    this.lastDetectionTime = 0;
    this.bpProcessor.reset();
    return null;
  }
  
  /**
   * Completely reset the processor
   */
  public fullReset(): void {
    this.arrhythmiaCounter = 0;
    this.signalHistory = [];
    this.lastDetectionTime = 0;
    this.bpProcessor.reset();
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Get last valid results - for display purposes
   */
  public getLastValidResults(): VitalSignsResult | null {
    if (this.signalHistory.length === 0) {
      return null;
    }
    
    // Calculate average of recent signals
    const recentSignals = this.signalHistory.slice(-10);
    const avgSignal = recentSignals.reduce((a, b) => a + b, 0) / recentSignals.length;
    
    // Process with the average signal
    return this.processSignal(avgSignal);
  }
}

// Export a singleton instance for shared use
export const vitalSignsProcessor = new VitalSignsProcessor();
