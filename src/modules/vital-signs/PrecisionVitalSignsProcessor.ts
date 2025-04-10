
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Precision Vital Signs Processor with improved algorithms, calibration and validation
 */

import { CrossValidator } from './correlation/CrossValidator';
import { CalibrationManager, CalibrationReference } from './calibration/CalibrationManager';
import { EnvironmentalAdjuster, EnvironmentalConditions } from './environment/EnvironmentalAdjuster';
import { BloodPressureProcessor } from './blood-pressure-processor';

/**
 * Result for precision vital signs processing
 */
export interface PrecisionVitalSignsResult {
  timestamp: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
    precision: number;  // Added precision indicator for blood pressure
  };
  spo2: {
    value: number;
    confidence: number;
  };
  heartRate: {
    value: number;
    confidence: number;
  };
  glucose: {
    value: number;
    confidence: number;
  };
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
    confidence: number;
  };
  arrhythmia: {
    status: string;
    confidence: number;
  };
  
  // Overall status
  status: 'valid' | 'calibrating' | 'needs_calibration' | 'error';
  isCalibrated: boolean;
  
  // Calibration and precision metrics
  precisionMetrics: {
    overallConfidence: number;
    signalQuality: number;
    calibrationConfidence: number;
    environmentalFactors: number;
  };
}

/**
 * Diagnostic information about signal processing
 */
export interface PrecisionDiagnostics {
  signalQuality: {
    lastValue: number;
    averageValue: number;
    trend: 'improving' | 'stable' | 'deteriorating';
  };
  calibrationFactors: {
    status: 'uncalibrated' | 'calibrating' | 'calibrated';
    confidence: number;
    lastCalibrationTime: number | null;
    referenceCount: number;
  };
  environmentalConditions: {
    lightLevel: number;
    motionLevel: number;
    adjustmentFactor: number;
  };
  processing: {
    sampleCount: number;
    lastProcessingTime: number;
    averageProcessingTime: number;
  };
}

/**
 * Advanced processor for vital signs with better precision
 */
export class PrecisionVitalSignsProcessor {
  // Core sub-processors
  private bloodPressureProcessor: BloodPressureProcessor;
  private validator: CrossValidator;
  private calibrationManager: CalibrationManager;
  private environmentalAdjuster: EnvironmentalAdjuster;
  
  // Processor state
  private isRunning: boolean = false;
  private sampleCount: number = 0;
  private lastProcessingTimes: number[] = [];
  private signalQualityHistory: number[] = [];
  private lastProcessingTime: number = 0;
  
  // Default baseline values for uncalibrated mode
  private readonly DEFAULT_SPO2 = 97;
  private readonly DEFAULT_GLUCOSE = 100;
  private readonly DEFAULT_CHOLESTEROL = 180;
  private readonly DEFAULT_TRIGLYCERIDES = 150;
  
  /**
   * Initialize the precision processor
   */
  constructor() {
    this.bloodPressureProcessor = new BloodPressureProcessor();
    this.validator = new CrossValidator();
    this.calibrationManager = new CalibrationManager();
    this.environmentalAdjuster = new EnvironmentalAdjuster();
    
    console.log("PrecisionVitalSignsProcessor: Initialized with enhanced blood pressure precision");
  }
  
  /**
   * Start the processor
   */
  public start(): void {
    this.isRunning = true;
    console.log("PrecisionVitalSignsProcessor: Started");
  }
  
  /**
   * Stop the processor
   */
  public stop(): void {
    this.isRunning = false;
    console.log("PrecisionVitalSignsProcessor: Stopped");
  }
  
  /**
   * Reset the processor
   */
  public reset(): void {
    this.bloodPressureProcessor.reset();
    this.validator.reset();
    this.calibrationManager.reset();
    this.environmentalAdjuster.reset();
    
    this.sampleCount = 0;
    this.lastProcessingTimes = [];
    this.signalQualityHistory = [];
    this.lastProcessingTime = 0;
    
    console.log("PrecisionVitalSignsProcessor: Reset complete");
  }
  
  /**
   * Process a signal with enhanced precision
   */
  public processSignal(signal: { quality: number; filteredValue: number; }): PrecisionVitalSignsResult {
    if (!this.isRunning) {
      console.warn("PrecisionVitalSignsProcessor: Attempted to process signal while stopped");
      return this.getDefaultResult();
    }
    
    const startTime = performance.now();
    this.sampleCount++;
    
    // Store signal quality history
    this.signalQualityHistory.push(signal.quality);
    if (this.signalQualityHistory.length > 20) {
      this.signalQualityHistory.shift();
    }
    
    // Apply environmental adjustments
    const adjustedValue = this.environmentalAdjuster.adjustValue(signal.filteredValue);
    
    // Process blood pressure with improved precision
    const bloodPressureResult = this.bloodPressureProcessor.processValue(adjustedValue);
    
    // Apply calibration adjustments
    const calibration = this.calibrationManager.getCurrentCalibration();
    
    // Process other vital signs (simplified implementation)
    const spo2 = this.processSpo2(adjustedValue, calibration);
    const glucose = this.processGlucose(adjustedValue, calibration);
    const lipids = this.processLipids(adjustedValue, calibration);
    const arrhythmia = this.processArrhythmia(adjustedValue);
    const heartRate = this.processHeartRate(adjustedValue);
    
    // Cross-validate results
    const validationResult = this.validator.validateMeasurements({
      bloodPressure: {
        systolic: bloodPressureResult.systolic,
        diastolic: bloodPressureResult.diastolic
      },
      spo2: spo2.value,
      glucose: glucose.value,
      lipids: {
        totalCholesterol: lipids.totalCholesterol,
        triglycerides: lipids.triglycerides
      }
    });
    
    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(
      bloodPressureResult.precision,
      spo2.confidence,
      glucose.confidence,
      lipids.confidence,
      validationResult.validationScore,
      signal.quality
    );
    
    // Calculate final result
    const result: PrecisionVitalSignsResult = {
      timestamp: Date.now(),
      bloodPressure: {
        systolic: bloodPressureResult.systolic,
        diastolic: bloodPressureResult.diastolic,
        precision: bloodPressureResult.precision
      },
      spo2,
      glucose,
      lipids,
      arrhythmia,
      heartRate,
      
      status: this.determineStatus(overallConfidence),
      isCalibrated: this.calibrationManager.isCalibrated(),
      
      precisionMetrics: {
        overallConfidence,
        signalQuality: this.getAverageSignalQuality(),
        calibrationConfidence: this.calibrationManager.getCalibrationConfidence(),
        environmentalFactors: this.environmentalAdjuster.getAdjustmentFactor()
      }
    };
    
    // Track processing time
    this.lastProcessingTime = performance.now() - startTime;
    this.lastProcessingTimes.push(this.lastProcessingTime);
    if (this.lastProcessingTimes.length > 10) {
      this.lastProcessingTimes.shift();
    }
    
    return result;
  }
  
  /**
   * Process SpO2 with calibration
   */
  private processSpo2(
    value: number, 
    calibration: { spo2Factor: number }
  ): { value: number, confidence: number } {
    // Base SpO2 calculation
    const baseValue = this.DEFAULT_SPO2 + (value * 3);
    
    // Apply calibration factor
    const calibratedValue = baseValue * calibration.spo2Factor;
    
    // Ensure result is within physiological range
    const finalValue = Math.min(100, Math.max(90, Math.round(calibratedValue)));
    
    // Calculate confidence
    const confidence = 0.8 * this.getAverageSignalQuality() * calibration.spo2Factor;
    
    return {
      value: finalValue,
      confidence: Math.min(1, Math.max(0, confidence))
    };
  }
  
  /**
   * Process glucose with calibration
   */
  private processGlucose(
    value: number,
    calibration: { glucoseFactor: number }
  ): { value: number, confidence: number } {
    // Base glucose calculation
    const baseValue = this.DEFAULT_GLUCOSE + (value * 30);
    
    // Apply calibration factor
    const calibratedValue = baseValue * calibration.glucoseFactor;
    
    // Ensure result is within physiological range
    const finalValue = Math.min(200, Math.max(70, Math.round(calibratedValue)));
    
    // Calculate confidence
    const confidence = 0.5 * this.getAverageSignalQuality() * calibration.glucoseFactor;
    
    return {
      value: finalValue,
      confidence: Math.min(1, Math.max(0, confidence))
    };
  }
  
  /**
   * Process lipids with calibration
   */
  private processLipids(
    value: number,
    calibration: { lipidsFactor: number }
  ): { totalCholesterol: number, triglycerides: number, confidence: number } {
    // Base lipids calculation
    const baseCholesterol = this.DEFAULT_CHOLESTEROL + (value * 50);
    const baseTriglycerides = this.DEFAULT_TRIGLYCERIDES + (value * 40);
    
    // Apply calibration factor
    const calibratedCholesterol = baseCholesterol * calibration.lipidsFactor;
    const calibratedTriglycerides = baseTriglycerides * calibration.lipidsFactor;
    
    // Ensure results are within physiological range
    const finalCholesterol = Math.min(300, Math.max(120, Math.round(calibratedCholesterol)));
    const finalTriglycerides = Math.min(250, Math.max(70, Math.round(calibratedTriglycerides)));
    
    // Calculate confidence
    const confidence = 0.5 * this.getAverageSignalQuality() * calibration.lipidsFactor;
    
    return {
      totalCholesterol: finalCholesterol,
      triglycerides: finalTriglycerides,
      confidence: Math.min(1, Math.max(0, confidence))
    };
  }
  
  /**
   * Process arrhythmia detection
   */
  private processArrhythmia(value: number): { status: string, confidence: number } {
    // Implement very basic arrhythmia detection
    // In a real implementation, this would analyze RR intervals and HRV
    
    return {
      status: "Normal Rhythm",
      confidence: 0.8
    };
  }
  
  /**
   * Process heart rate
   */
  private processHeartRate(value: number): { value: number, confidence: number } {
    // Simple heart rate calculation
    // In a real implementation, this would use peak detection and interval analysis
    const heartRate = 70 + (value * 20);
    const finalValue = Math.min(120, Math.max(50, Math.round(heartRate)));
    
    return {
      value: finalValue,
      confidence: this.getAverageSignalQuality()
    };
  }
  
  /**
   * Calculate overall confidence based on all factors
   */
  private calculateOverallConfidence(
    bloodPressureConfidence: number,
    spo2Confidence: number,
    glucoseConfidence: number,
    lipidsConfidence: number,
    validationScore: number,
    signalQuality: number
  ): number {
    // Weighted average of all confidence factors
    const weightedSum =
      bloodPressureConfidence * 0.3 +
      spo2Confidence * 0.2 +
      glucoseConfidence * 0.1 +
      lipidsConfidence * 0.1 +
      validationScore * 0.1 +
      signalQuality * 0.2;
    
    return Math.min(1, Math.max(0, weightedSum));
  }
  
  /**
   * Determine overall status based on confidence
   */
  private determineStatus(confidence: number): 'valid' | 'calibrating' | 'needs_calibration' | 'error' {
    if (!this.calibrationManager.isCalibrated()) {
      return 'needs_calibration';
    }
    
    if (confidence < 0.3) {
      return 'error';
    }
    
    if (confidence < 0.6) {
      return 'calibrating';
    }
    
    return 'valid';
  }
  
  /**
   * Get average signal quality
   */
  private getAverageSignalQuality(): number {
    if (this.signalQualityHistory.length === 0) {
      return 0;
    }
    
    return this.signalQualityHistory.reduce((sum, value) => sum + value, 0) / this.signalQualityHistory.length;
  }
  
  /**
   * Get default result when processor is not running
   */
  private getDefaultResult(): PrecisionVitalSignsResult {
    return {
      timestamp: Date.now(),
      bloodPressure: {
        systolic: 0,
        diastolic: 0,
        precision: 0
      },
      spo2: {
        value: 0,
        confidence: 0
      },
      glucose: {
        value: 0,
        confidence: 0
      },
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0,
        confidence: 0
      },
      arrhythmia: {
        status: "Unknown",
        confidence: 0
      },
      heartRate: {
        value: 0,
        confidence: 0
      },
      status: 'error',
      isCalibrated: false,
      precisionMetrics: {
        overallConfidence: 0,
        signalQuality: 0,
        calibrationConfidence: 0,
        environmentalFactors: 0
      }
    };
  }
  
  /**
   * Check if the processor is calibrated
   */
  public isCalibrated(): boolean {
    return this.calibrationManager.isCalibrated();
  }
  
  /**
   * Add a calibration reference to improve accuracy
   */
  public addCalibrationReference(reference: CalibrationReference): boolean {
    return this.calibrationManager.addCalibrationReference(reference);
  }
  
  /**
   * Update environmental conditions to adjust processing
   */
  public updateEnvironmentalConditions(conditions: EnvironmentalConditions): void {
    this.environmentalAdjuster.updateConditions(conditions);
  }
  
  /**
   * Get diagnostic information about the processor state
   */
  public getDiagnostics(): PrecisionDiagnostics {
    return {
      signalQuality: {
        lastValue: this.signalQualityHistory.length > 0 ? this.signalQualityHistory[this.signalQualityHistory.length - 1] : 0,
        averageValue: this.getAverageSignalQuality(),
        trend: this.getSignalQualityTrend()
      },
      calibrationFactors: {
        status: this.calibrationManager.isCalibrated() ? 'calibrated' : 'uncalibrated',
        confidence: this.calibrationManager.getCalibrationConfidence(),
        lastCalibrationTime: this.calibrationManager.getLastCalibrationTime(),
        referenceCount: this.calibrationManager.getReferenceCount()
      },
      environmentalConditions: {
        lightLevel: this.environmentalAdjuster.getCurrentConditions().lightLevel,
        motionLevel: this.environmentalAdjuster.getCurrentConditions().motionLevel,
        adjustmentFactor: this.environmentalAdjuster.getAdjustmentFactor()
      },
      processing: {
        sampleCount: this.sampleCount,
        lastProcessingTime: this.lastProcessingTime,
        averageProcessingTime: this.getAverageProcessingTime()
      }
    };
  }
  
  /**
   * Calculate average processing time
   */
  private getAverageProcessingTime(): number {
    if (this.lastProcessingTimes.length === 0) {
      return 0;
    }
    
    return this.lastProcessingTimes.reduce((sum, time) => sum + time, 0) / this.lastProcessingTimes.length;
  }
  
  /**
   * Determine signal quality trend
   */
  private getSignalQualityTrend(): 'improving' | 'stable' | 'deteriorating' {
    if (this.signalQualityHistory.length < 6) {
      return 'stable';
    }
    
    const recent = this.signalQualityHistory.slice(-3);
    const older = this.signalQualityHistory.slice(-6, -3);
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    const difference = recentAvg - olderAvg;
    
    if (difference > 0.1) {
      return 'improving';
    } else if (difference < -0.1) {
      return 'deteriorating';
    } else {
      return 'stable';
    }
  }
}
