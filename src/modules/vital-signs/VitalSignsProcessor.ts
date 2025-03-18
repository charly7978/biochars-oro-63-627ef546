
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsResult } from './types/vital-signs-result';
import { SignalValidator } from './validators/signal-validator';
import { SignalProcessor } from './signal-processor';
import { ArrhythmiaDetector } from './arrhythmia/arrhythmia-detector';
import { BloodPressureEstimator } from './blood-pressure/blood-pressure-estimator';
import { OxygenSaturationCalculator } from './oxygen/oxygen-saturation-calculator';

/**
 * Main processor for vital signs that only uses direct measurements
 * No simulation or data manipulation allowed
 */
export class VitalSignsProcessor {
  private signalProcessor: SignalProcessor;
  private signalValidator: SignalValidator;
  private arrhythmiaDetector: ArrhythmiaDetector;
  private bloodPressureEstimator: BloodPressureEstimator;
  private oxygenCalculator: OxygenSaturationCalculator;
  
  private ppgValues: number[] = [];
  private arrhythmiaCounter: number = 0;
  private qualityScores: number[] = [];
  
  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance with direct measurement only");
    
    // Initialize signal processor
    this.signalProcessor = new SignalProcessor();
    
    // Initialize validator
    this.signalValidator = new SignalValidator();
    
    // Initialize specialized processors
    this.arrhythmiaDetector = new ArrhythmiaDetector();
    this.bloodPressureEstimator = new BloodPressureEstimator();
    this.oxygenCalculator = new OxygenSaturationCalculator();
    
    // Reset everything to initial state
    this.reset();
  }
  
  /**
   * Process real PPG signal to extract vital signs
   * Direct measurement only, no simulation
   */
  public processSignal(
    value: number, 
    rrData?: { intervals: number[], lastPeakTime: number | null }
  ): VitalSignsResult {
    if (!this.signalValidator.isValidSignal(value)) {
      return this.createEmptyResult();
    }
    
    // Apply filters to real signal
    const { filteredValue, quality } = this.signalProcessor.applyFilters(value);
    
    // Add to PPG buffer for analysis
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > 60) {
      this.ppgValues.shift();
    }
    
    // Track quality
    this.qualityScores.push(quality);
    if (this.qualityScores.length > 10) {
      this.qualityScores.shift();
    }
    
    // Check if we have enough valid data
    const hasValidAmplitude = this.signalValidator.hasValidAmplitude(this.ppgValues);
    const hasEnoughData = this.signalValidator.hasEnoughData(this.ppgValues);
    
    if (!hasValidAmplitude || !hasEnoughData) {
      this.signalValidator.logValidationResults(
        hasValidAmplitude, 
        this.calculateSignalAmplitude(), 
        this.ppgValues.length
      );
      return this.createEmptyResult();
    }
    
    // Detect arrhythmia using real data
    const arrhythmiaResult = this.detectArrhythmia(rrData);
    if (arrhythmiaResult.isArrhythmia) {
      this.arrhythmiaCounter = Math.min(100, this.arrhythmiaCounter + 1);
    }
    
    // Calculate heart rate from real signal
    const heartRate = this.signalProcessor.calculateHeartRate(30);
    
    // Calculate SpO2 from real signal
    const spo2 = this.oxygenCalculator.calculateSpO2(this.ppgValues);
    
    // Estimate blood pressure (no simulation)
    const bloodPressure = this.bloodPressureEstimator.estimateBloodPressure(
      this.ppgValues, 
      heartRate
    );
    
    // Generate result from real measurements
    return {
      spo2: spo2,
      pressure: bloodPressure,
      arrhythmiaStatus: this.getArrhythmiaStatus(),
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      }
    };
  }
  
  /**
   * Get the number of arrhythmias detected
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }
  
  /**
   * Reset the processor
   */
  public reset(): void {
    this.ppgValues = [];
    this.arrhythmiaCounter = 0;
    this.qualityScores = [];
    this.signalProcessor.reset();
  }
  
  /**
   * Complete reset of all processors
   */
  public fullReset(): void {
    this.reset();
    this.arrhythmiaDetector.reset();
    this.bloodPressureEstimator.reset();
    this.oxygenCalculator.reset();
  }
  
  /**
   * Detect arrhythmia from R-R intervals
   */
  private detectArrhythmia(
    rrData?: { intervals: number[], lastPeakTime: number | null }
  ): { isArrhythmia: boolean, score: number } {
    if (!rrData || !rrData.intervals || rrData.intervals.length < 5) {
      return { isArrhythmia: false, score: 0 };
    }
    
    return this.arrhythmiaDetector.detectArrhythmia(rrData.intervals);
  }
  
  /**
   * Get arrhythmia status text based on counter
   */
  private getArrhythmiaStatus(): string {
    if (this.arrhythmiaCounter <= 1) return "NORMAL";
    if (this.arrhythmiaCounter <= 5) return "POSIBLE";
    if (this.arrhythmiaCounter <= 15) return "LEVE";
    if (this.arrhythmiaCounter <= 30) return "MODERADA";
    return "SIGNIFICATIVA";
  }
  
  /**
   * Calculate amplitude of the signal
   * Real data analysis only
   */
  private calculateSignalAmplitude(): number {
    if (this.ppgValues.length < 10) return 0;
    
    const recentValues = this.ppgValues.slice(-10);
    return Math.max(...recentValues) - Math.min(...recentValues);
  }
  
  /**
   * Create empty result when data is insufficient
   */
  private createEmptyResult(): VitalSignsResult {
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
}

// Export VitalSignsResult type for use in other modules
export type { VitalSignsResult } from './types/vital-signs-result';
