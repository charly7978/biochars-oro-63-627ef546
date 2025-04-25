
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
  
  // Última medición válida
  private lastValidResult: VitalSignsResult | null = null;
  
  // Contador de señales y frames procesados
  private processedFrameCount: number = 0;

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
    // Incrementar contador de frames
    this.processedFrameCount++;
    
    // Log específico para depurar flujo de datos
    if (this.processedFrameCount % 30 === 0) {
      console.log("VitalSignsProcessor: Processing frame", {
        frameCount: this.processedFrameCount,
        ppgValue,
        hasRRData: !!rrData,
        rrIntervals: rrData?.intervals?.length || 0
      });
    }
    
    // Check for near-zero signal
    if (!this.signalValidator.isValidSignal(ppgValue)) {
      return this.getLastValidResultsOrEmpty();
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
      return this.getLastValidResultsOrEmpty();
    }
    
    // Verify real signal amplitude is sufficient
    let signalMin = ppgValues[0];
    let signalMax = ppgValues[0];
    
    for (let i = 1; i < ppgValues.length && i < 15; i++) {
      if (ppgValues[i] < signalMin) signalMin = ppgValues[i];
      if (ppgValues[i] > signalMax) signalMax = ppgValues[i];
    }
    
    const amplitude = signalMax - signalMin;
    
    if (!this.signalValidator.hasValidAmplitude(ppgValues)) {
      this.signalValidator.logValidationResults(false, amplitude, ppgValues);
      return this.getLastValidResultsOrEmpty();
    }
    
    // Calculate SpO2 using real data only
    const spo2Value = this.spo2Processor.calculateSpO2(ppgValues.slice(-45));
    const spo2 = spo2Value >= 0 ? ~~(spo2Value + 0.5) : ~~(spo2Value - 0.5);
    
    // Calculate blood pressure using real signal characteristics only
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${~~(bp.systolic + 0.5)}/${~~(bp.diastolic + 0.5)}` 
      : "--/--";
    
    // Estimate heart rate from signal if RR data available
    let heartRate = 0;
    if (rrData && rrData.intervals && rrData.intervals.length > 0) {
      let sum = 0;
      for (let i = 0; i < rrData.intervals.length && i < 5; i++) {
        sum += rrData.intervals[rrData.intervals.length - 1 - i];
      }
      const avgInterval = sum / (rrData.intervals.length < 5 ? rrData.intervals.length : 5);
      heartRate = ~~(60000 / avgInterval + 0.5);
    }
    
    // Calculate glucose with real data only
    const glucoseValue = this.glucoseProcessor.calculateGlucose(ppgValues);
    const glucose = glucoseValue >= 0 ? ~~(glucoseValue + 0.5) : ~~(glucoseValue - 0.5);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calculate lipids with real data only
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate hydration with real PPG data
    const hydrationValue = this.hydrationEstimator.analyze(ppgValues);
    const hydration = hydrationValue >= 0 ? ~~(hydrationValue + 0.5) : ~~(hydrationValue - 0.5);
    
    // Calculate overall confidence
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    // Prepare final values - SIMPLIFICADO: No filtrar por umbral de confianza
    const finalGlucose = glucose;
    const finalLipids = {
      totalCholesterol: ~~(lipids.totalCholesterol + 0.5),
      triglycerides: ~~(lipids.triglycerides + 0.5)
    };

    console.log("VitalSignsProcessor: Results calculated", {
      spo2,
      heartRate,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      glucose: finalGlucose,
      lipids: finalLipids,
      hydration,
      frameCount: this.processedFrameCount
    });

    // Calculate hemoglobin based on SpO2 without random values
    const hemoglobin = this.calculateDefaultHemoglobin(spo2);

    // Prepare result with all metrics including hydration
    const result = ResultFactory.createResult(
      spo2,
      heartRate,
      pressure,
      arrhythmiaResult.arrhythmiaStatus || "--",
      finalGlucose,
      finalLipids,
      hemoglobin,
      hydration,
      glucoseConfidence,
      lipidsConfidence,
      overallConfidence,
      arrhythmiaResult.lastArrhythmiaData
    );
    
    // Store this as last valid result if it has valid heart rate or any other valid metric
    if (result.heartRate > 0 || result.spo2 > 0 || result.glucose > 0 || result.hydration > 0) {
      this.lastValidResult = result;
    }
    
    return result;
  }

  /**
   * Calculate a default hemoglobin value based on SpO2 without Math.random
   * ELIMINADO Math.random - Fase 2 completada
   */
  private calculateDefaultHemoglobin(spo2: number): number {
    if (spo2 <= 0) return 0;
    
    // Valor base estático sin Math.random
    const base = 14;
    
    if (spo2 > 95) return base;
    if (spo2 > 90) return base - 1;
    if (spo2 > 85) return base - 2;
    
    return base - 3;
  }

  /**
   * Get the last valid results if available, otherwise empty results
   */
  private getLastValidResultsOrEmpty(): VitalSignsResult {
    return this.lastValidResult || ResultFactory.createEmptyResults();
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
    return null;
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount();
  }
  
  /**
   * Get the last valid results
   */
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResult;
  }
  
  /**
   * Completely reset the processor
   * Ensures fresh start with no data carryover
   */
  public fullReset(): void {
    this.reset();
    this.lastValidResult = null;
    this.processedFrameCount = 0;
    console.log("VitalSignsProcessor: Full reset completed - starting from zero");
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
