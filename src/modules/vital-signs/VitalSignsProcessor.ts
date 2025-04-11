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
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance...");
    
    this.signalProcessor = new SignalProcessor();
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    this.hydrationEstimator = new HydrationEstimator();
    this.signalValidator = new SignalValidator(0.02, 15);
    this.confidenceCalculator = new ConfidenceCalculator(0.15);
  }
  
  /**
   * Processes the real PPG signal and calculates all vital signs
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
      
    // 1. Process the new value (filter & update central buffer)
    this.signalProcessor.processNewValue(ppgValue);
    
    // 2. Get the updated filtered buffer
    const ppgValues = this.signalProcessor.getFilteredPPGValues();
    
    // 3. Check if finger is detected (using SignalProcessor's state)
    if (!this.signalProcessor.isFingerDetected()) {
       // Optional: Log why finger is not detected (e.g., based on signalValidator inside SignalProcessor)
       // console.log("VitalSignsProcessor: Finger not detected by SignalProcessor.");
       return ResultFactory.createEmptyResults();
    }

    // 4. Check if we have enough data points in the central buffer
    if (ppgValues.length < 15) { // Use a minimal threshold consistent with validators/processors
        // console.log(`VitalSignsProcessor: Not enough data yet (${ppgValues.length})`);
        return ResultFactory.createEmptyResults();
    }

    // --- Perform Calculations using slices of the main buffer --- 

    // Process arrhythmia data if available and valid
    // (Keep this logic as it uses external rrData)
    const arrhythmiaResult = rrData && 
                           rrData.intervals && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };

    // Define analysis window sizes
    const ANALYSIS_WINDOW_SIZE = 150; // ~5 seconds
    const SPO2_WINDOW_SIZE = 45;      // ~1.5 seconds
    const BP_WINDOW_SIZE = 90;        // ~3 seconds
    const MIN_SAMPLES_SHORT = 15;     // ~0.5 seconds
    const MIN_SAMPLES_MEDIUM = 30;    // ~1 second

    // Create slices (avoid recalculating length repeatedly)
    const bufferLength = ppgValues.length;
    const recentPpgValues = bufferLength >= MIN_SAMPLES_MEDIUM ? ppgValues.slice(-ANALYSIS_WINDOW_SIZE) : [];
    const spo2Window = bufferLength >= MIN_SAMPLES_SHORT ? ppgValues.slice(-SPO2_WINDOW_SIZE) : [];
    const bpWindow = bufferLength >= MIN_SAMPLES_MEDIUM ? ppgValues.slice(-BP_WINDOW_SIZE) : [];

    // --- Restore Processor Calls (using appropriate windows) --- 

    // Calculate SpO2 
    const spo2 = spo2Window.length >= MIN_SAMPLES_SHORT ?
                 Math.round(this.spo2Processor.calculateSpO2(spo2Window)) : 0;
    
    // Calculate blood pressure 
    const bpResult = bpWindow.length >= MIN_SAMPLES_MEDIUM ?
                     this.bpProcessor.calculateBloodPressure(bpWindow) :
                     null;
    const bp = bpResult || { systolic: 0, diastolic: 0 }; 
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` 
      : "--/--";
    
    // Calculate glucose 
    const glucose = recentPpgValues.length >= MIN_SAMPLES_MEDIUM ?
                    Math.round(this.glucoseProcessor.calculateGlucose(recentPpgValues)) : 0;
    const glucoseConfidence = this.glucoseProcessor.getConfidence(); 
    
    // Calculate lipids 
    const lipidsResult = recentPpgValues.length >= MIN_SAMPLES_MEDIUM ?
                       this.lipidProcessor.calculateLipids(recentPpgValues) :
                       { totalCholesterol: 0, triglycerides: 0 };
    const lipids = lipidsResult;
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate hydration 
    const hydration = recentPpgValues.length >= MIN_SAMPLES_MEDIUM ?
                      Math.round(this.hydrationEstimator.analyze(recentPpgValues)) : 0;
    
    // --- Calculate BPM --- 
    const heartRate = bufferLength >= MIN_SAMPLES_MEDIUM ? // Need enough data for reliable HR
                       Math.round(this.signalProcessor.calculateHeartRate()) : 0;

    // Calculate overall confidence (using restored confidence values)
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
    
    // Calculate Hemoglobin deterministically
    const hemoglobin = Math.round(this.calculateHemoglobin(spo2));

    // --- Logging (optional) --- 
    // console.log("VitalSignsProcessor: Results", { ... });

    // --- Prepare final result object --- 
    const result: VitalSignsResult = {
       spo2,
       pressure,
       heartRate, // Include calculated heart rate
       arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus || "--",
       glucose: finalGlucose,
       lipids: finalLipids,
       hemoglobin,
       hydration,
       glucoseConfidence,
       lipidsConfidence,
       overallConfidence,
       lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData
    }

    return result;
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
   */
  public reset(): VitalSignsResult | null {
    this.signalProcessor.reset(); // Resets buffer and its state
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.hydrationEstimator.reset();
    // No need to reset signalValidator separately if using signalProcessor's state
    console.log("VitalSignsProcessor: Reset complete.");
    return null; 
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount();
  }
  
  /**
   * Get the last valid results - always returns null
   */
  public getLastValidResults(): VitalSignsResult | null {
    return null; 
  }
  
  /**
   * Completely reset the processor
   */
  public fullReset(): void {
    this.reset();
    console.log("VitalSignsProcessor: Full reset completed.");
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
