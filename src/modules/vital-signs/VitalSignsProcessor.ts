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
  private confidenceCalculator: ConfidenceCalculator;

  // Throttling state
  private lastCalculationTime: number = 0;
  private readonly CALCULATION_INTERVAL_MS = 200; // Calculate ~5 times per second
  private lastValidResult: VitalSignsResult = ResultFactory.createEmptyResults();

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
    this.confidenceCalculator = new ConfidenceCalculator(0.15);
  }
  
  /**
   * Processes the real PPG signal and calculates all vital signs
   */
  public processSignal(
    ppgValue: number, // This raw value might not be needed if we rely on the processed buffer
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
      
    // 1. Process the new value (filter & update central buffer in SignalProcessor)
    // This also updates SignalProcessor's internal finger detection state
    this.signalProcessor.processNewValue(ppgValue); 
    
    // 2. Check finger presence using the central SignalProcessor state
    const isFingerDetected = this.signalProcessor.isFingerDetected();
    
    // 3. Get the updated filtered buffer from SignalProcessor
    const ppgValues = this.signalProcessor.getFilteredPPGValues();
    
    // --- Handle Finger Loss/Return --- 
    if (!isFingerDetected) {
        if (this.lastValidResult !== ResultFactory.createEmptyResults()) {
            console.log("VitalSignsProcessor: Finger lost/signal unstable (from SignalProcessor). Pausing BP, resetting others."); // Updated log
            this.bpProcessor.pauseMeasurement(); 
            this.spo2Processor.reset();
            this.glucoseProcessor.reset();
            this.lipidProcessor.reset();
            this.hydrationEstimator.reset();
            this.arrhythmiaProcessor.reset();
            this.lastCalculationTime = 0; 
            this.lastValidResult = ResultFactory.createEmptyResults(); 
        }
        return ResultFactory.createEmptyResults(); 
    } else {
        this.bpProcessor.resumeMeasurement();
    }
    // --- End Finger Handling --- 

    // 4. Check if we have enough data points in the central buffer
    // Use a slightly higher threshold here to ensure some stability after finger is detected
    const MIN_SAMPLES_FOR_CALCS = 30; // Changed from 15 to 30 (1 second)
    if (ppgValues.length < MIN_SAMPLES_FOR_CALCS) { 
         // console.log(`VitalSignsProcessor: Buffer too short (${ppgValues.length}/${MIN_SAMPLES_FOR_CALCS})`);
         return this.lastValidResult; // Return last valid result while buffer fills
    }

    // --- Throttling --- 
    const now = Date.now();
    if (now - this.lastCalculationTime < this.CALCULATION_INTERVAL_MS) {
        return this.lastValidResult;
    }
    this.lastCalculationTime = now;

    // Process arrhythmia data 
    const arrhythmiaResult = rrData && 
                           rrData.intervals && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };

    // Define analysis window sizes & min samples
    const ANALYSIS_WINDOW_SIZE = 150;
    const SPO2_WINDOW_SIZE = 45;
    const BP_WINDOW_SIZE = 90;
    const MIN_SAMPLES_SHORT = 15;     // For SpO2
    const MIN_SAMPLES_MEDIUM = 30;    // For others

    // Create slices 
    const bufferLength = ppgValues.length;
    const recentPpgValues = bufferLength >= MIN_SAMPLES_MEDIUM ? ppgValues.slice(-ANALYSIS_WINDOW_SIZE) : [];
    const spo2Window = bufferLength >= MIN_SAMPLES_SHORT ? ppgValues.slice(-SPO2_WINDOW_SIZE) : [];
    const bpWindow = bufferLength >= MIN_SAMPLES_MEDIUM ? ppgValues.slice(-BP_WINDOW_SIZE) : [];

    // --- Processor Calls --- 
    const spo2 = spo2Window.length >= MIN_SAMPLES_SHORT ?
                 Math.round(this.spo2Processor.calculateSpO2(spo2Window)) : 0;
    console.log(`>>> SpO2 Raw Calc: ${spo2}`); // DEBUG
    
    const bpResult = bpWindow.length >= MIN_SAMPLES_MEDIUM ?
                     this.bpProcessor.calculateBloodPressure(bpWindow) :
                     null;
    console.log(`>>> BP Raw Result: ${JSON.stringify(bpResult)}`); // DEBUG
    const bp = bpResult || { systolic: 0, diastolic: 0 }; 
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` 
      : "--/--";
    console.log(`>>> BP Formatted: ${pressure}`); // DEBUG
    
    const glucose = recentPpgValues.length >= MIN_SAMPLES_MEDIUM ?
                    Math.round(this.glucoseProcessor.calculateGlucose(recentPpgValues)) : 0;
    const glucoseConfidence = this.glucoseProcessor.getConfidence(); 
    console.log(`>>> Glucose Raw Calc: ${glucose}, Confidence: ${glucoseConfidence}`); // DEBUG
    
    const lipidsResult = recentPpgValues.length >= MIN_SAMPLES_MEDIUM ?
                       this.lipidProcessor.calculateLipids(recentPpgValues) :
                       { totalCholesterol: 0, triglycerides: 0 };
    const lipids = lipidsResult;
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    console.log(`>>> Lipids Raw Calc: ${JSON.stringify(lipids)}, Confidence: ${lipidsConfidence}`); // DEBUG
    
    const hydration = recentPpgValues.length >= MIN_SAMPLES_MEDIUM ?
                      Math.round(this.hydrationEstimator.analyze(recentPpgValues)) : 0;
    console.log(`>>> Hydration Raw Calc: ${hydration}`); // DEBUG
    
    const heartRate = bufferLength >= MIN_SAMPLES_MEDIUM ? 
                       Math.round(this.signalProcessor.calculateHeartRate()) : 0;
    console.log(`>>> Heart Rate Raw Calc: ${heartRate}`); // DEBUG

    // Confidence & Final Values 
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );
    const finalGlucose = this.confidenceCalculator.meetsThreshold(glucoseConfidence) ? glucose : 0;
    const finalLipids = this.confidenceCalculator.meetsThreshold(lipidsConfidence) ? {
      totalCholesterol: Math.round(lipids.totalCholesterol),
      triglycerides: Math.round(lipids.triglycerides)
    } : { totalCholesterol: 0, triglycerides: 0 };
    console.log(`>>> Glucose Final: ${finalGlucose}, Lipids Final: ${JSON.stringify(finalLipids)}`); // DEBUG
    
    const hemoglobin = Math.round(this.calculateHemoglobin(spo2));

    // --- Update lastValidResult --- 
    this.lastValidResult = {
       spo2,
       pressure,
       heartRate, 
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

    return this.lastValidResult;
  }

  /**
   * Calculate Hemoglobin based on SpO2 (deterministic)
   */
  private calculateHemoglobin(spo2: number): number {
    if (spo2 <= 0 || spo2 > 100) return 0; // Invalid SpO2
    
    const base = 15.0; 
    const maxReduction = 5.0;
    const lowSpo2Threshold = 85.0;

    if (spo2 >= 98) return base;
    if (spo2 < lowSpo2Threshold) return base - maxReduction;
    
    const reductionFactor = (98.0 - spo2) / (98.0 - lowSpo2Threshold);
    return base - (maxReduction * reductionFactor);
  }

  // Renamed original reset to avoid conflict, called by reset() and signal loss
  private resetProcessorsAndState(): void {
    this.signalProcessor.reset(); // Resets buffer & finger detection state
    this.spo2Processor.reset();
    this.bpProcessor.reset(); // BP full reset here
    this.arrhythmiaProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.hydrationEstimator.reset();
    this.lastCalculationTime = 0; 
    this.lastValidResult = ResultFactory.createEmptyResults();
  }

  /**
   * Reset the processor to ensure a clean state
   */
  public reset(): VitalSignsResult | null {
    this.resetProcessorsAndState();
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
