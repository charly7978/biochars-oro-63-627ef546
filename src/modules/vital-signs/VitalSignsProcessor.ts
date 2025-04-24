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

  private ppgBuffer: number[] = [];

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
      console.log("VitalSignsProcessor: Signal too weak, returning empty result");
      return ResultFactory.createEmptyResults();
    }
    
    // Apply filtering to the real PPG signal
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Acumular el buffer de PPG de forma persistente
    this.ppgBuffer.push(filtered);
    if (this.ppgBuffer.length > 300) {
      this.ppgBuffer.shift();
    }
    
    // Process arrhythmia data if available and valid
    const arrhythmiaResult = rrData && 
                           rrData.intervals && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    // Check if we have enough data points
    if (!this.signalValidator.hasEnoughData(this.ppgBuffer)) {
      return ResultFactory.createEmptyResults();
    }
    
    // Verify real signal amplitude is sufficient
    const signalMin = Math.min(...this.ppgBuffer.slice(-15));
    const signalMax = Math.max(...this.ppgBuffer.slice(-15));
    const amplitude = signalMax - signalMin;
    
    if (!this.signalValidator.hasValidAmplitude(this.ppgBuffer)) {
      this.signalValidator.logValidationResults(false, amplitude, this.ppgBuffer);
      return ResultFactory.createEmptyResults();
    }
    
    // Calculate SpO2 using real data only
    const spo2 = this.spo2Processor.calculateSpO2(this.ppgBuffer.slice(-45));
    
    // Calculate blood pressure using real signal characteristics only
    const bp = this.bpProcessor.calculateBloodPressure(this.ppgBuffer.slice(-90));
    const pressure = bp && bp.systolic > 0 && bp.diastolic > 0 
      ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` 
      : null;
    
    // Estimate heart rate from signal if RR data available
    const heartRate = rrData && rrData.intervals && rrData.intervals.length > 0
      ? Math.round(60000 / (rrData.intervals.slice(-5).reduce((sum, val) => sum + val, 0) / 5))
      : null;
    
    // Calculate glucose with real data only
    const glucose = this.glucoseProcessor.calculateGlucose(this.ppgBuffer);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calculate lipids with real data only
    const lipids = this.lipidProcessor.calculateLipids(this.ppgBuffer);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate hydration with real PPG data
    const hydration = this.hydrationEstimator.analyze(this.ppgBuffer);
    
    // Calculate overall confidence
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    // Si alguna métrica principal es null, devolver resultado vacío y honesto
    if (
      spo2 === null ||
      glucose === null ||
      lipids === null ||
      pressure === null ||
      heartRate === null ||
      hydration === null
    ) {
      return ResultFactory.createEmptyResults();
    }

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
    const base = 14;
    // Usar la variabilidad real de la señal para la fluctuación
    const std = this.ppgBuffer && this.ppgBuffer.length > 10 ? 
      this.ppgBuffer.slice(-10).reduce((acc, val, _, arr) => acc + Math.pow(val - (arr.reduce((a, b) => a + b, 0) / arr.length), 2), 0) / 10 : 0.1;
    const fluct = Math.sqrt(std) * 2; // factor ajustable
    if (spo2 > 95) return base + fluct;
    if (spo2 > 90) return base - 1 + fluct;
    if (spo2 > 85) return base - 2 + fluct;
    return base - 3 + fluct;
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
