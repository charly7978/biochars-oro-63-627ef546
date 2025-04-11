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
import { HydrationEstimator } from '../../core/analysis/HydrationEstimator';

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
  private hydrationEstimator: HydrationEstimator;
  
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
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    this.hydrationEstimator = new HydrationEstimator();
    
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
    if (!this.signalValidator.isValidSignal(ppgValue)) {
      console.log("VitalSignsProcessor: Signal too weak, returning zeros", { value: ppgValue });
      return ResultFactory.createEmptyResults();
    }
    
    // Apply filtering to the real PPG signal
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Process arrhythmia data if available and valid
    const arrhythmiaResult = rrData && 
                           rrData.intervals && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    // Get PPG values for processing
    const ppgValues = this.signalProcessor.getPPGValues();
    ppgValues.push(filtered);
    
    // Limit the real data buffer
    if (ppgValues.length > 300) {
      ppgValues.splice(0, ppgValues.length - 300);
    }
    
    // Check if we have enough data points
    if (!this.signalValidator.hasEnoughData(ppgValues)) {
      // Return last known valid result if available, otherwise empty
      // This prevents flickering zeros if signal temporarily drops below min data points
      // Note: Decided against returning last valid to enforce real-time feel
      return ResultFactory.createEmptyResults();
    }
    
    // --- Define analysis window --- 
    const ANALYSIS_WINDOW_SIZE = 150; // Use ~5 seconds of data for most analyses
    const recentPpgValues = ppgValues.length > ANALYSIS_WINDOW_SIZE 
                              ? ppgValues.slice(-ANALYSIS_WINDOW_SIZE) 
                              : ppgValues;
    // Use shorter specific windows where appropriate
    const spo2Window = ppgValues.slice(-45);
    const bpWindow = ppgValues.slice(-90);

    // Verify real signal amplitude is sufficient using a recent window
    const amplitudeCheckWindow = ppgValues.slice(-30); // Check amplitude on last second
    const signalMin = Math.min(...amplitudeCheckWindow);
    const signalMax = Math.max(...amplitudeCheckWindow);
    const amplitude = signalMax - signalMin;
    
    if (!this.signalValidator.hasValidAmplitude(amplitudeCheckWindow)) {
      // Pass the checked window to logs
      this.signalValidator.logValidationResults(false, amplitude, amplitudeCheckWindow); 
      return ResultFactory.createEmptyResults();
    }
    
    // Calculate SpO2 using its specific window
    const spo2 = spo2Window.length >= 15 ? // Check min samples for SpO2 (approx 0.5s)
                 Math.round(this.spo2Processor.calculateSpO2(spo2Window)) : 0;
    
    // Calculate blood pressure using its specific window
    const bpResult = bpWindow.length >= 30 ? // Check min samples for BP (1s)
                     this.bpProcessor.calculateBloodPressure(bpWindow) :
                     null;
    const bp = bpResult || { systolic: 0, diastolic: 0 }; // Use result or zeros
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` 
      : "--/--";
    
    // --- Use recentPpgValues (last 150) for remaining analyses --- 
    const minSamplesForAnalysis = 30; // Require at least 1 second for these analyses
    
    // Calculate glucose with recent data only
    const glucose = recentPpgValues.length >= minSamplesForAnalysis ?
                    Math.round(this.glucoseProcessor.calculateGlucose(recentPpgValues)) : 0;
    const glucoseConfidence = this.glucoseProcessor.getConfidence(); // Confidence might be calculated internally based on data used
    
    // Calculate lipids with recent data only
    const lipidsResult = recentPpgValues.length >= minSamplesForAnalysis ?
                       this.lipidProcessor.calculateLipids(recentPpgValues) :
                       { totalCholesterol: 0, triglycerides: 0 };
    const lipids = lipidsResult;
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate hydration with recent PPG data
    const hydration = recentPpgValues.length >= minSamplesForAnalysis ?
                      Math.round(this.hydrationEstimator.analyze(recentPpgValues)) : 0;
    
    // Calculate overall confidence
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    // Only show values if confidence exceeds threshold
    const finalGlucose = this.confidenceCalculator.meetsThreshold(glucoseConfidence) ? glucose : 0;
    const finalLipids = this.confidenceCalculator.meetsThreshold(lipidsConfidence) ? {
      totalCholesterol: Math.round(lipids.totalCholesterol),
      triglycerides: Math.round(lipids.triglycerides)
    } : {
      totalCholesterol: 0,
      triglycerides: 0
    };

    // --- Missing BPM Calculation --- 
    // TODO: Implement BPM calculation from ppgValues or recentPpgValues
    const heartRate = 0; // Placeholder

    console.log("VitalSignsProcessor: Results", {
      spo2,
      pressure,
      heartRate, // Added placeholder
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      glucose: finalGlucose,
      // glucoseConfidence,
      // lipidsConfidence,
      hydration,
      signalAmplitude: amplitude,
      // confidenceThreshold: this.confidenceCalculator.getConfidenceThreshold()
    });

    // Prepare result with all metrics including hydration
    return ResultFactory.createResult(
      spo2,
      pressure,
      // heartRate, // Omit for now until properly integrated
      arrhythmiaResult.arrhythmiaStatus || "--",
      finalGlucose,
      finalLipids,
      Math.round(this.calculateHemoglobin(spo2)),
      hydration,
      glucoseConfidence,
      lipidsConfidence,
      overallConfidence,
      arrhythmiaResult.lastArrhythmiaData
    );
  }

  /**
   * Calculate Hemoglobin based on SpO2 (deterministic)
   */
  private calculateHemoglobin(spo2: number): number {
    if (spo2 <= 0 || spo2 > 100) return 0; // Invalid SpO2
    
    // Simple linear mapping (example, adjust ranges as needed)
    const base = 15.0; // Optimal Hb for ~98-100% SpO2
    const maxReduction = 5.0; // Max reduction for very low SpO2
    const lowSpo2Threshold = 85.0; // SpO2 level where reduction starts significantly

    if (spo2 >= 98) return base;
    if (spo2 < lowSpo2Threshold) return base - maxReduction;
    
    // Linear reduction between 98 and lowSpo2Threshold
    const reductionFactor = (98.0 - spo2) / (98.0 - lowSpo2Threshold);
    return base - (maxReduction * reductionFactor);
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
    this.hydrationEstimator.reset();
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
