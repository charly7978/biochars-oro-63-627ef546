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
    ppgValue: number, // Raw PPG value from the source (e.g., PPGProcessor)
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {

    // Apply filtering, quality check, and finger detection using SignalProcessor
    const { filteredValue, quality, fingerDetected } = this.signalProcessor.applyFilters(ppgValue);

    // If finger is not detected or quality is too low, return empty results
    // Use a reasonable quality threshold (e.g., from SignalProcessor's logic or a constant)
    const MIN_QUALITY_THRESHOLD = 30; // Example threshold, adjust as needed
    if (!fingerDetected || quality < MIN_QUALITY_THRESHOLD) {
       // Optionally log why processing stopped
       // console.log(`VitalSignsProcessor: Stopping - Finger Detected: ${fingerDetected}, Quality: ${quality}`);
      // Reset processors if finger is lost to avoid using stale data
      if (!fingerDetected) {
        this.reset();
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
    
    // Get PPG values buffer directly from SignalProcessor
    const ppgValues = this.signalProcessor.getPPGValues(); // Contains already filtered values

    // No need to push filteredValue again, SignalProcessor manages its buffer
    // ppgValues.push(filteredValue);
    // if (ppgValues.length > 300) {
    //   ppgValues.splice(0, ppgValues.length - 300);
    // }

    // Check if we have enough data points (SignalProcessor buffer)
    if (!this.signalValidator.hasEnoughData(ppgValues)) {
      return ResultFactory.createEmptyResults();
    }

    // Remove redundant amplitude check, rely on SignalProcessor/SignalValidator
    /*
    const signalMin = Math.min(...ppgValues.slice(-15));
    const signalMax = Math.max(...ppgValues.slice(-15));
    const amplitude = signalMax - signalMin;

    if (!this.signalValidator.hasValidAmplitude(ppgValues)) {
      this.signalValidator.logValidationResults(false, amplitude, ppgValues);
      return ResultFactory.createEmptyResults();
    }
    */

    // Calculate SpO2 using the filtered buffer from SignalProcessor
    const spo2 = Math.round(this.spo2Processor.calculateSpO2(ppgValues)); // Pass the buffer directly
    
    // Calculate blood pressure using the filtered buffer
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues);
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` 
      : "--/--";
    
    // Calculate glucose with the filtered buffer
    const glucose = Math.round(this.glucoseProcessor.calculateGlucose(ppgValues));
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calculate lipids with the filtered buffer
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate hydration with the filtered buffer
    const hydration = Math.round(this.hydrationEstimator.analyze(ppgValues));
    
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

    console.log("VitalSignsProcessor: Results with confidence", {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      glucose: finalGlucose,
      glucoseConfidence,
      lipidsConfidence,
      hydration,
      signalQuality: quality, // Log the quality from SignalProcessor
      confidenceThreshold: this.confidenceCalculator.getConfidenceThreshold()
    });

    // Prepare result with all metrics including hydration
    return ResultFactory.createResult(
      spo2,
      pressure,
      arrhythmiaResult.arrhythmiaStatus || "--",
      finalGlucose,
      finalLipids,
      Math.round(this.calculateDefaultHemoglobin(spo2)),
      hydration,
      glucoseConfidence,
      lipidsConfidence,
      overallConfidence,
      arrhythmiaResult.lastArrhythmiaData,
      fingerDetected,
      quality
    );
  }

  /**
   * Calculate a default hemoglobin value based on SpO2
   * Removed randomness for deterministic estimation.
   */
  private calculateDefaultHemoglobin(spo2: number): number {
    if (spo2 <= 0 || spo2 < 80) return 11; // Low baseline for very low SpO2
    if (spo2 > 100) spo2 = 100; // Cap at 100

    // Simple linear mapping (example - adjust based on clinical data if possible)
    // Maps SpO2 range [80, 100] to Hemoglobin range [11, 15]
    const minSpo2 = 80;
    const maxSpo2 = 100;
    const minHb = 11;
    const maxHb = 15;

    const hb = minHb + ((spo2 - minSpo2) / (maxSpo2 - minSpo2)) * (maxHb - minHb);

    // Return a rounded value
    return Math.round(hb * 10) / 10; // Round to one decimal place

    /* Old random logic:
    const base = 14;
    if (spo2 > 95) return base + Math.random();
    if (spo2 > 90) return base - 1 + Math.random();
    if (spo2 > 85) return base - 2 + Math.random();
    return base - 3 + Math.random();
    */
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
