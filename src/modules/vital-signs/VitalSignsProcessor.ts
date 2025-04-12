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
import { calculateAC, calculateDC, calculateStandardDeviation, findPeaksAndValleys, calculateAmplitude } from '@/utils/signalAnalysisUtils';
import { BaseProcessor } from './processors/base-processor';
import { UserProfile } from '@/core/types';
import { HemoglobinEstimator } from '@/core/analysis/HemoglobinEstimator';

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
  private hemoglobinEstimator: HemoglobinEstimator;
  
  // Validators and calculators
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;
  private lastValidResult: VitalSignsResult | null = null;
  private processorInitialized: boolean = false;
  private userProfile: UserProfile | null = null;

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
    this.hydrationEstimator = new HydrationEstimator(this.userProfile || undefined);
    this.hemoglobinEstimator = new HemoglobinEstimator(this.userProfile || undefined);
    
    // Initialize validators and calculators
    this.signalValidator = new SignalValidator();
    this.confidenceCalculator = new ConfidenceCalculator();
    this.initializeProcessors();
  }
  
  private async initializeProcessors() {
    console.log("VitalSignsProcessors Initialized");
    this.processorInitialized = true;
  }

  public setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    this.hydrationEstimator.setUserProfile(profile);
    this.hemoglobinEstimator.setUserProfile(profile);
  }

  /**
   * Processes the real PPG signal and calculates all vital signs
   * Using ONLY direct measurements with no reference values or simulation
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    if (!this.processorInitialized) {
      console.warn("VitalSignsProcessor not initialized, returning empty results.");
      return ResultFactory.createEmptyResults();
    }

    const { filteredValue, quality, fingerDetected } = this.signalProcessor.applyFilters(ppgValue);

    if (!fingerDetected || quality < 30) {
      return this.lastValidResult ?? ResultFactory.createEmptyResults();
    }

    this.signalProcessor.addValue(filteredValue);
    const currentSignalBuffer = this.signalProcessor.getPPGValues();

    if (!this.signalValidator.hasEnoughData(currentSignalBuffer) || !this.signalValidator.hasValidAmplitude(currentSignalBuffer)) {
      return this.lastValidResult ?? ResultFactory.createEmptyResults();
    }

    const spo2 = this.spo2Processor.calculateSpO2(currentSignalBuffer);
    const { systolic, diastolic } = this.bpProcessor.calculateBloodPressure(currentSignalBuffer);
    const glucose = this.glucoseProcessor.calculateGlucose(currentSignalBuffer);
    const lipids = this.lipidProcessor.calculateLipids(currentSignalBuffer);
    const hydration = this.hydrationEstimator.analyze(currentSignalBuffer);
    const hemoglobin = this.hemoglobinEstimator.analyze(currentSignalBuffer);

    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);

    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    const result = ResultFactory.createResult(
      spo2,
      `${Math.round(systolic)}/${Math.round(diastolic)}`,
      arrhythmiaResult.arrhythmiaStatus,
      glucose,
      lipids,
      hemoglobin,
      hydration,
      glucoseConfidence,
      lipidsConfidence,
      overallConfidence,
      arrhythmiaResult.lastArrhythmiaData
    );

    if (systolic < 50 || systolic > 250 || diastolic < 30 || diastolic > 150 || spo2 < 70 || spo2 > 100) {
      console.warn("Potentially invalid physiological values detected", result);
      return this.lastValidResult ?? ResultFactory.createEmptyResults();
    }

    this.lastValidResult = result;
    return result;
  }

  /**
   * Reset the processor to ensure a clean state
   * No reference values or simulations
   */
  public reset(): VitalSignsResult | null {
    console.log("Resetting VitalSignsProcessor and sub-processors.");
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.hydrationEstimator.reset();
    this.hemoglobinEstimator.reset();
    this.signalValidator.resetFingerDetection();

    const lastResultBeforeReset = this.lastValidResult;
    this.lastValidResult = null;
    return lastResultBeforeReset;
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
    return this.lastValidResult;
  }
  
  /**
   * Completely reset the processor
   * Ensures fresh start with no data carryover
   */
  public fullReset(): void {
    console.log("Performing full reset of VitalSignsProcessor.");
    this.reset();
    this.lastValidResult = null;
    this.userProfile = null;
    this.processorInitialized = false;
    this.initializeProcessors();
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
