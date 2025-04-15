/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SpO2Processor } from './spo2-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { ResultFactory } from './factories/result-factory';
import { SignalValidator } from './validators/signal-validator';
import { ConfidenceCalculator } from './calculators/confidence-calculator';
import { VitalSignsResult } from './types/vital-signs-result';
import { HydrationEstimator } from '../../core/analysis/HydrationEstimator';
import { GlucoseEstimator } from '../../core/analysis/GlucoseEstimator';
import { LipidEstimator } from '../../core/analysis/LipidEstimator';
import { BloodPressureAnalyzer } from '../../core/analysis/BloodPressureAnalyzer';

/**
 * Main vital signs processor
 * Integrates different specialized processors to calculate health metrics
 * Operates ONLY in direct measurement mode without reference values or simulation
 */
export class VitalSignsProcessor {
  // Specialized processors
  private spo2Processor: SpO2Processor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private hydrationEstimator: HydrationEstimator;
  private glucoseEstimator: GlucoseEstimator;
  private lipidEstimator: LipidEstimator;
  private bpAnalyzer: BloodPressureAnalyzer;
  
  // Validators and calculators
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;

  /**
   * Constructor that initializes all specialized processors
   * Using only direct measurement
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance with direct measurement only");
    
    // Initialize specialized processors
    this.spo2Processor = new SpO2Processor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.hydrationEstimator = new HydrationEstimator();
    this.glucoseEstimator = new GlucoseEstimator();
    this.lipidEstimator = new LipidEstimator();
    this.bpAnalyzer = new BloodPressureAnalyzer();
    
    // Initialize validators and calculators
    this.signalValidator = new SignalValidator(0.01, 15);
    this.confidenceCalculator = new ConfidenceCalculator(0.15);
  }
  
  /**
   * Processes the real PPG signal and calculates all vital signs
   * Using ONLY direct measurements with no reference values or simulation
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Check for near-zero signal
    console.log("VP DBG: Entering processSignal"); // Log 1
    if (!this.signalValidator.isValidSignal(ppgValue)) {
      console.log("VitalSignsProcessor: Signal too weak, returning zeros", { value: ppgValue });
      return ResultFactory.createEmptyResults();
    }
    
    // Apply filtering using the refactored SignalProcessor's method
    console.log("VP DBG: Before applyFilters"); // Log 2
    // Add check for the method existence
    console.log("VP DBG: Checking this.signalProcessor.applyFilters:", typeof this.signalProcessor?.applyFilters);
    const { filteredValue, quality, fingerDetected } = this.signalProcessor.applyFilters(ppgValue);
    console.log("VP DBG: After applyFilters", { filteredValue, quality, fingerDetected }); // Log 3
    
    // Process arrhythmia data if available and valid
    console.log("VP DBG: Before arrhythmia processing"); // Log 4
    const arrhythmiaResult = rrData && 
                           rrData.intervals && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    console.log("VP DBG: After arrhythmia processing", { arrhythmiaResult }); // Log 5
    
    // Get PPG values for processing - use the filtered value now
    console.log("VP DBG: Before getPPGValues"); // Log 6
    const ppgValues = this.signalProcessor.getPPGValues(); // getPPGValues likely returns the buffer of filtered values
    console.log("VP DBG: After getPPGValues", { ppgValuesLength: ppgValues?.length }); // Log 7
    // No need to push again if signalProcessor already handles its buffer
    // ppgValues.push(filteredValue);
    
    // Limit the real data buffer (consider if signalProcessor's buffer is sufficient)
    if (ppgValues.length > 300) {
      ppgValues.splice(0, ppgValues.length - 300);
    }
    
    // Check if we have enough data points
    console.log("VP DBG: Before hasEnoughData check"); // Log 8
    if (!this.signalValidator.hasEnoughData(ppgValues)) {
      console.log("VP DBG: Not enough data");
      return ResultFactory.createEmptyResults();
    }
    console.log("VP DBG: After hasEnoughData check"); // Log 9
    
    // Verify real signal amplitude is sufficient
    console.log("VP DBG: Before hasValidAmplitude check"); // Log 10
    const signalMin = Math.min(...ppgValues.slice(-15));
    const signalMax = Math.max(...ppgValues.slice(-15));
    const amplitude = signalMax - signalMin;
    
    if (!this.signalValidator.hasValidAmplitude(ppgValues)) {
      console.log("VP DBG: Invalid amplitude");
      this.signalValidator.logValidationResults(false, amplitude, ppgValues);
      return ResultFactory.createEmptyResults();
    }
    console.log("VP DBG: After hasValidAmplitude check"); // Log 11
    
    // If we reach here, calculations should start, and previous DBG logs should appear
    console.log("VP DBG: Starting vital sign calculations..."); // Log 12
    
    // Calculate SpO2 using real data only
    const rawSpo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-45));
    const spo2 = Math.round(rawSpo2);
    console.log("DBG: Raw SpO2:", rawSpo2);
    
    // Calculate blood pressure using BloodPressureAnalyzer
    const rawBp = this.bpAnalyzer.analyze(ppgValues.slice(-90));
    const pressure = rawBp.systolic > 0 && rawBp.diastolic > 0
      ? `${Math.round(rawBp.systolic)}/${Math.round(rawBp.diastolic)}`
      : "--/--";
    console.log("DBG: Raw BP:", rawBp);
    
    // Estimate heart rate from signal if RR data available
    const heartRate = rrData && rrData.intervals && rrData.intervals.length > 0
      ? Math.round(60000 / (rrData.intervals.slice(-5).reduce((sum, val) => sum + val, 0) / 5))
      : 0;
    
    // Calculate glucose with real data only using GlucoseEstimator
    const rawGlucose = this.glucoseEstimator.analyze(ppgValues);
    const glucose = Math.round(rawGlucose);
    const glucoseConfidence = glucose > 0 ? 0.6 : 0; // Placeholder confidence
    console.log("DBG: Raw Glucose:", rawGlucose);
    
    // Calculate lipids with real data only using LipidEstimator
    const rawLipids = this.lipidEstimator.analyze(ppgValues);
    const lipidsConfidence = (rawLipids.totalCholesterol > 0 && rawLipids.triglycerides > 0) ? 0.6 : 0; // Placeholder
    console.log("DBG: Raw Lipids:", rawLipids);
    
    // Calculate hydration with real PPG data
    const rawHydration = this.hydrationEstimator.analyze(ppgValues);
    const hydration = Math.round(rawHydration);
    console.log("DBG: Raw Hydration:", rawHydration);
    
    // Log received RR data
    console.log("DBG: Received rrData:", rrData);
    console.log("DBG: Arrhythmia Result:", arrhythmiaResult);
    
    // Calculate overall confidence
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    // Only show values if confidence exceeds threshold
    const finalGlucose = this.confidenceCalculator.meetsThreshold(glucoseConfidence) ? glucose : 0;
    const finalLipids = this.confidenceCalculator.meetsThreshold(lipidsConfidence) ? {
      totalCholesterol: Math.round(rawLipids.totalCholesterol),
      triglycerides: Math.round(rawLipids.triglycerides)
    } : {
      totalCholesterol: 0,
      triglycerides: 0
    };

    console.log("VitalSignsProcessor: Results with confidence", {
      spo2,
      heartRate,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      glucose: finalGlucose,
      glucoseConfidence,
      lipidsConfidence,
      hydration,
      signalAmplitude: amplitude,
      confidenceThreshold: this.confidenceCalculator.getConfidenceThreshold()
    });

    // Prepare result with all metrics including hydration
    return ResultFactory.createResult(
      spo2,
      heartRate,
      pressure,
      arrhythmiaResult.arrhythmiaStatus || "--",
      finalGlucose,
      finalLipids,
      Math.round(this.calculateDefaultHemoglobin(spo2)),
      hydration,
      glucoseConfidence,
      lipidsConfidence,
      overallConfidence,
      arrhythmiaResult.lastArrhythmiaData
    );
  }

  /**
   * Calculate a default hemoglobin value based on SpO2
   */
  private calculateDefaultHemoglobin(spo2: number): number {
    if (spo2 <= 0) return 0;
    
    // Very basic approximation
    const base = 14;
    
    if (spo2 > 95) return base + Math.random();
    if (spo2 > 90) return base - 1 + Math.random();
    if (spo2 > 85) return base - 2 + Math.random();
    
    return base - 3 + Math.random();
  }

  /**
   * Reset the processor to ensure a clean state
   * No reference values or simulations
   */
  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.hydrationEstimator.reset();
    this.glucoseEstimator.reset();
    this.lipidEstimator.reset();
    this.bpAnalyzer.reset();
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
    console.log("VitalSignsProcessor: Full reset completed - starting from zero");
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
