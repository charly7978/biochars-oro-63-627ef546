
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { CalibrationManager, CalibrationReference } from './calibration/CalibrationManager';
import { CrossValidator, CrossValidationResult } from './correlation/CrossValidator';
import { 
  EnvironmentalAdjuster, 
  EnvironmentalConditions,
  EnvironmentalAdjustments
} from './environment/EnvironmentalAdjuster';
import { 
  ModularVitalSignsProcessor, 
  ModularVitalSignsResult, 
  ProcessedSignal 
} from './ModularVitalSignsProcessor';
import { VitalSignsResult } from './types/vital-signs-result';

/**
 * Enhanced vital signs processor with precision mechanisms
 * Including calibration, validation, and environmental adjustments
 */
export interface PrecisionVitalSignsResult {
  timestamp: number;
  bpm: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  confidence: {
    bpm: number;
    bloodPressure: number;
    spo2: number;
    glucose: number;
    lipids: number;
    overall: number;
  };
  spo2: number;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  crossValidationResults?: CrossValidationResult;
  environmentalAdjustments?: EnvironmentalAdjustments;
}

export interface PrecisionProcessorOptions {
  calibrationEnabled: boolean;
  crossValidationEnabled: boolean;
  environmentalAdjustments: boolean;
  adaptiveGain: number;
}

export interface CalibrationStatus {
  isCalibrated: boolean;
  hasReference: boolean;
  lastCalibrationTime?: number;
  calibrationAccuracy?: number;
}

/**
 * Enhanced processor for vital signs with precision features
 * All calculations are based on direct measurements, no simulation
 */
export class PrecisionVitalSignsProcessor {
  private baseProcessor: ModularVitalSignsProcessor;
  private calibrationManager: CalibrationManager;
  private crossValidator: CrossValidator;
  private environmentalAdjuster: EnvironmentalAdjuster;
  private options: PrecisionProcessorOptions;
  private isProcessing: boolean = false;
  private lastProcessedSignal: any = null;
  private lastResult: PrecisionVitalSignsResult | null = null;
  
  constructor(options?: Partial<PrecisionProcessorOptions>) {
    // Initialize components
    this.baseProcessor = new ModularVitalSignsProcessor();
    this.calibrationManager = new CalibrationManager();
    this.crossValidator = new CrossValidator();
    this.environmentalAdjuster = new EnvironmentalAdjuster();
    
    // Set default options
    this.options = {
      calibrationEnabled: true,
      crossValidationEnabled: true,
      environmentalAdjustments: true,
      adaptiveGain: 0.3,
      ...options
    };
    
    console.log("PrecisionVitalSignsProcessor initialized with options", this.options);
  }
  
  /**
   * Start processing signals
   */
  public startProcessing(): void {
    this.isProcessing = true;
    this.baseProcessor.startProcessing();
    console.log("PrecisionVitalSignsProcessor: Processing started");
  }
  
  /**
   * Stop processing signals
   */
  public stopProcessing(): void {
    this.isProcessing = false;
    this.baseProcessor.stopProcessing();
    console.log("PrecisionVitalSignsProcessor: Processing stopped");
  }
  
  /**
   * Process a signal with all precision enhancements
   * Direct measurement only - no simulation
   */
  public processSignal(signal: {
    timestamp: number;
    rawValue: number;
    filteredValue: number;
    quality: number;
    fingerDetected: boolean;
    roi?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    perfusionIndex?: number;
    spectrumData?: {
      frequencies: number[];
      amplitudes: number[];
      dominantFrequency: number;
    };
    diagnosticInfo?: Record<string, any>;
  }): PrecisionVitalSignsResult | null {
    if (!this.isProcessing || !signal.fingerDetected) {
      return null;
    }
    
    this.lastProcessedSignal = signal;
    
    // Prepare signal for base processor
    const processedSignal: ProcessedSignal = {
      value: signal.filteredValue,
      timestamp: signal.timestamp,
      quality: signal.quality
    };
    
    // Apply environmental adjustments
    let adjustedSignal = processedSignal;
    if (this.options.environmentalAdjustments) {
      adjustedSignal = this.environmentalAdjuster.adjustSignal(processedSignal);
    }
    
    // Process with base processor
    const baseResult = this.baseProcessor.processSignal(adjustedSignal);
    
    // Apply calibration if enabled
    let calibratedResult = baseResult;
    if (this.options.calibrationEnabled && this.calibrationManager.hasReferences()) {
      calibratedResult = this.calibrationManager.calibrateResults(baseResult);
    }
    
    // Cross-validate if enabled
    let validationResults: CrossValidationResult | undefined;
    if (this.options.crossValidationEnabled) {
      validationResults = this.crossValidator.validateResults(calibratedResult, signal.quality);
    }
    
    // Format enhanced result
    const heartRate = calibratedResult.heartRate || 0;
    const bloodPressure = calibratedResult.pressure ? 
      this.parseBloodPressure(calibratedResult.pressure) : 
      { systolic: 0, diastolic: 0 };
    
    // Create enhanced result
    const result: PrecisionVitalSignsResult = {
      timestamp: signal.timestamp,
      bpm: heartRate,
      spo2: calibratedResult.spo2 || 0,
      bloodPressure,
      arrhythmiaStatus: calibratedResult.arrhythmiaStatus || "--",
      glucose: calibratedResult.glucose || 0,
      lipids: calibratedResult.lipids || { totalCholesterol: 0, triglycerides: 0 },
      confidence: {
        bpm: signal.quality * (validationResults?.heartRateConfidence || 1.0),
        bloodPressure: signal.quality * (validationResults?.bloodPressureConfidence || 0.9),
        spo2: signal.quality * (validationResults?.spo2Confidence || 0.95),
        glucose: signal.quality * (validationResults?.glucoseConfidence || 0.8),
        lipids: signal.quality * (validationResults?.lipidsConfidence || 0.75),
        overall: signal.quality * (validationResults?.overallConfidence || 0.85)
      }
    };
    
    // Add validation results if available
    if (validationResults) {
      result.crossValidationResults = validationResults;
    }
    
    // Add environmental adjustments if applied
    if (this.options.environmentalAdjustments) {
      result.environmentalAdjustments = this.environmentalAdjuster.getLastAdjustments();
    }
    
    this.lastResult = result;
    
    // Log results
    this.logResults(result);
    
    return result;
  }
  
  /**
   * Add calibration reference data
   */
  public addCalibrationReference(reference: CalibrationReference): boolean {
    return this.calibrationManager.addCalibrationReference(reference);
  }
  
  /**
   * Update environmental conditions
   */
  public updateEnvironmentalConditions(conditions: EnvironmentalConditions): void {
    this.environmentalAdjuster.updateConditions(conditions);
  }
  
  /**
   * Parse blood pressure string
   */
  private parseBloodPressure(pressureStr: string): { systolic: number; diastolic: number } {
    if (!pressureStr || pressureStr === "--/--") {
      return { systolic: 0, diastolic: 0 };
    }
    
    const parts = pressureStr.split('/');
    if (parts.length !== 2) {
      return { systolic: 0, diastolic: 0 };
    }
    
    return {
      systolic: parseInt(parts[0], 10) || 0,
      diastolic: parseInt(parts[1], 10) || 0
    };
  }
  
  /**
   * Log results
   */
  private logResults(result: PrecisionVitalSignsResult): void {
    console.log("PrecisionVitalSignsProcessor: Results", {
      bpm: result.bpm,
      spo2: result.spo2,
      bp: `${result.bloodPressure.systolic}/${result.bloodPressure.diastolic}`,
      heartRateConfidence: result.confidence.bpm.toFixed(2),
      environmentalAdjustments: result.environmentalAdjustments ? "Applied" : "None"
    });
  }
  
  /**
   * Check if processor is calibrated
   */
  public getCalibrationStatus(): CalibrationStatus {
    return {
      isCalibrated: this.calibrationManager.hasReferences(),
      hasReference: this.calibrationManager.hasReferences(),
      lastCalibrationTime: this.calibrationManager.getLastCalibrationTime(),
      calibrationAccuracy: this.calibrationManager.getCalibrationAccuracy()
    };
  }
  
  /**
   * Get diagnostics data
   */
  public getDiagnostics(): {
    calibrationFactors: {
      confidence: number;
      coefficients: Record<string, number>;
    };
    environmentalConditions: EnvironmentalConditions;
    signalQuality: {
      rawValue: number;
      filteredValue: number;
      quality: number;
      fingerDetected: boolean;
    };
    processingMetrics: {
      lastProcessingTime: number;
      avgProcessingTime: number;
    };
  } {
    return {
      calibrationFactors: {
        confidence: this.calibrationManager.getCalibrationAccuracy() || 0,
        coefficients: this.calibrationManager.getCalibrationCoefficients()
      },
      environmentalConditions: this.environmentalAdjuster.getCurrentConditions(),
      signalQuality: {
        rawValue: this.lastProcessedSignal?.rawValue || 0,
        filteredValue: this.lastProcessedSignal?.filteredValue || 0,
        quality: this.lastProcessedSignal?.quality || 0,
        fingerDetected: this.lastProcessedSignal?.fingerDetected || false
      },
      processingMetrics: {
        lastProcessingTime: Date.now(),
        avgProcessingTime: 0 // Would be calculated in a real implementation
      }
    };
  }
  
  /**
   * Reset processor
   */
  public reset(): void {
    this.baseProcessor.reset();
    this.lastProcessedSignal = null;
    this.lastResult = null;
  }
}
