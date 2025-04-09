
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';
import { ResultFactory } from './factories/result-factory';
import { SignalValidator } from './validators/signal-validator';
import { ConfidenceCalculator } from './calculators/confidence-calculator';
import { VitalSignsResult } from './types/vital-signs-result';

/**
 * Main vital signs processor
 * Integrates different specialized processors to calculate health metrics
 * Operates ONLY in direct measurement mode without reference values or simulation
 */
export class VitalSignsProcessor {
  // Specialized processors
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  
  // Validators and calculators
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;
  
  // Signal quality and buffering
  private signalQualityBuffer: number[] = [];
  private startTime: number = Date.now();
  private processedCount: number = 0;
  private MIN_MEASUREMENTS_REQUIRED = 30;

  /**
   * Constructor that initializes all specialized processors
   * Using only direct measurement
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance with direct measurement only");
    
    // Initialize specialized processors
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    
    // Initialize validators and calculators
    this.signalValidator = new SignalValidator(0.003, 8); // More sensitive thresholds
    this.confidenceCalculator = new ConfidenceCalculator(0.1); // Reduced threshold
  }
  
  /**
   * Processes the real PPG signal and calculates all vital signs
   * Using ONLY direct measurements with no reference values or simulation
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    this.processedCount++;
    
    // Check for near-zero or invalid signal
    if (!this.isValidValue(ppgValue)) {
      if (this.processedCount % 30 === 0) {
        console.log("VitalSignsProcessor: Invalid signal value", { value: ppgValue });
      }
      return ResultFactory.createEmptyResults();
    }
    
    // Apply filtering to the real PPG signal
    const filterResult = this.signalProcessor.applyFilters(ppgValue);
    
    // Update signal quality buffer
    this.updateSignalQualityBuffer(filterResult.quality);
    
    // Check if finger is detected
    if (!filterResult.fingerDetected) {
      if (this.processedCount % 30 === 0) {
        console.log("VitalSignsProcessor: Finger not detected", {
          fingerDetected: filterResult.fingerDetected,
          quality: filterResult.quality,
          value: ppgValue,
          filtered: filterResult.filteredValue
        });
      }
      return ResultFactory.createEmptyResults();
    }
    
    // Process arrhythmia data if available and valid
    const arrhythmiaResult = rrData && 
                           rrData.intervals &&
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    // Get PPG values for processing
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Check if we have enough data points and signal quality
    const avgQuality = this.calculateAverageQuality();
    const signalQualityThreshold = this.getAdaptiveQualityThreshold();
    
    if (ppgValues.length < this.MIN_MEASUREMENTS_REQUIRED || avgQuality < signalQualityThreshold) {
      if (this.processedCount % 30 === 0) {
        console.log("VitalSignsProcessor: Insufficient data or quality", {
          dataPoints: ppgValues.length,
          required: this.MIN_MEASUREMENTS_REQUIRED,
          avgQuality,
          threshold: signalQualityThreshold,
          timeRunning: (Date.now() - this.startTime) / 1000,
          processed: this.processedCount
        });
      }
      
      // Return empty results with arrhythmia data if available
      return ResultFactory.createEmptyResultsWithArrhythmia(arrhythmiaResult.arrhythmiaStatus, arrhythmiaResult.lastArrhythmiaData);
    }
    
    // Calculate SpO2 using real data only
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-45));
    
    // Calculate blood pressure using real signal characteristics only
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // Calculate glucose with real data only
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calculate lipids with real data only
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate overall confidence
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    // Only show values if confidence exceeds threshold
    const finalGlucose = this.confidenceCalculator.meetsThreshold(glucoseConfidence) ? glucose : 0;
    const finalLipids = this.confidenceCalculator.meetsThreshold(lipidsConfidence) ? lipids : {
      totalCholesterol: 0,
      triglycerides: 0
    };

    if (this.processedCount % 30 === 0) {
      console.log("VitalSignsProcessor: Results with confidence", {
        spo2,
        pressure,
        arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
        glucose: finalGlucose,
        glucoseConfidence,
        lipidsConfidence,
        signalQuality: avgQuality,
        confidenceThreshold: this.confidenceCalculator.getConfidenceThreshold(),
        fingerDetected: filterResult.fingerDetected
      });
    }

    // Prepare result with all metrics
    return ResultFactory.createResult(
      spo2,
      pressure,
      arrhythmiaResult.arrhythmiaStatus,
      finalGlucose,
      finalLipids,
      {
        glucose: glucoseConfidence,
        lipids: lipidsConfidence,
        overall: overallConfidence
      },
      arrhythmiaResult.lastArrhythmiaData
    );
  }
  
  /**
   * Check if value is valid
   */
  private isValidValue(value: number): boolean {
    return !isNaN(value) && isFinite(value) && Math.abs(value) < 1000;
  }
  
  /**
   * Update signal quality buffer
   */
  private updateSignalQualityBuffer(quality: number): void {
    this.signalQualityBuffer.push(quality);
    if (this.signalQualityBuffer.length > 10) {
      this.signalQualityBuffer.shift();
    }
  }
  
  /**
   * Calculate average signal quality
   */
  private calculateAverageQuality(): number {
    if (this.signalQualityBuffer.length === 0) {
      return 0;
    }
    
    const sum = this.signalQualityBuffer.reduce((a, b) => a + b, 0);
    return sum / this.signalQualityBuffer.length;
  }
  
  /**
   * Get adaptive quality threshold based on running time
   */
  private getAdaptiveQualityThreshold(): number {
    const runningTimeMs = Date.now() - this.startTime;
    
    // Be more lenient in the first 10 seconds
    if (runningTimeMs < 10000) {
      return 15;
    }
    
    // Then gradually increase the threshold
    if (runningTimeMs < 20000) {
      return 20;
    }
    
    // Standard threshold
    return 25;
  }

  /**
   * Reset the processor to ensure a clean state
   * No reference values or simulations
   */
  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.signalQualityBuffer = [];
    console.log("VitalSignsProcessor: Reset complete - all processors at zero");
    return null; // Always return null to ensure measurements start from zero
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount();
  }
  
  /**
   * Get the last valid results - always returns null
   * Forces fresh measurements without reference values
   */
  public getLastValidResults(): VitalSignsResult | null {
    return null; // Always return null to ensure measurements start from zero
  }
  
  /**
   * Completely reset the processor
   * Ensures fresh start with no data carryover
   */
  public fullReset(): void {
    this.reset();
    this.processedCount = 0;
    this.startTime = Date.now();
    console.log("VitalSignsProcessor: Full reset completed - starting from zero");
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
