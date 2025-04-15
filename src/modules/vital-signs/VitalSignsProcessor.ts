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
import { calculateStandardDeviation } from "./shared-signal-utils";
import { findPeaksAndValleys } from './utils';

// Define a type for the new quality metrics
export interface DetailedSignalQuality {
  cardiacClarity: number; // 0-100, clarity and regularity of pulse waveform
  ppgStability: number;   // 0-100, stability and suitability for absorption measurements
  overallQuality: number; // Original quality metric, potentially derived from these two
}

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

  // Add state for detailed quality
  private detailedQuality: DetailedSignalQuality = { cardiacClarity: 0, ppgStability: 0, overallQuality: 0 };

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
  ): VitalSignsResult | null {
    // Check for near-zero signal
    if (!this.signalValidator.isValidSignal(ppgValue)) {
      console.log("VitalSignsProcessor: Signal too weak, returning null", { value: ppgValue });
       this.resetDetailedQuality(); // Reset detailed quality on weak signal
      return null;
    }
    
    // Apply filtering to the real PPG signal
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Get PPG values for processing
    const ppgValues = this.signalProcessor.getPPGValues();
    ppgValues.push(filtered);
    
    // Limit the real data buffer
    if (ppgValues.length > 300) {
      ppgValues.splice(0, ppgValues.length - 300);
    }
    
    // Check if we have enough data points
    if (!this.signalValidator.hasEnoughData(ppgValues)) {
      this.resetDetailedQuality();
      return null; // Not enough data yet
    }
    
    // --- Calculate Detailed Quality Metrics --- START ---
    this.calculateDetailedQuality(ppgValues, rrData);
    // --- Calculate Detailed Quality Metrics --- END ---

    // Use overallQuality from detailedQuality for further checks if needed
    // For now, we continue using the existing validation logic

    // Verify real signal amplitude is sufficient
    const signalMin = Math.min(...ppgValues.slice(-15));
    const signalMax = Math.max(...ppgValues.slice(-15));
    const amplitude = signalMax - signalMin;
    
    if (!this.signalValidator.hasValidAmplitude(ppgValues)) {
      this.signalValidator.logValidationResults(false, amplitude, ppgValues);
      this.resetDetailedQuality(false); // Keep last calculated quality if amplitude fails?
      return null; // Amplitude too low
    }
    
    // Process arrhythmia data if available and valid
    const arrhythmiaResult = rrData && 
                           rrData.intervals && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    // Calculate SpO2 using real data only
    const spo2 = Math.round(this.spo2Processor.calculateSpO2(ppgValues.slice(-45)));
    
    // Calculate blood pressure using real signal characteristics only
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` 
      : "--/--";
    
    // Estimate heart rate from signal if RR data available
    const heartRate = rrData && rrData.intervals && rrData.intervals.length > 0
      ? Math.round(60000 / (rrData.intervals.slice(-5).reduce((sum, val) => sum + val, 0) / 5))
      : 0;
    
    // Calculate glucose with real data only
    const glucose = Math.round(this.glucoseProcessor.calculateGlucose(ppgValues));
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calculate lipids with real data only
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate hydration with real PPG data
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

    // Prepare result including detailed quality
    const finalResult = ResultFactory.createResult(
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

    // Add detailed quality to the result (or handle it separately if ResultFactory isn't modified)
    // For simplicity, let's assume we return it separately for now via a getter.

    return finalResult;
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
   */
  public reset(): null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.hydrationEstimator.reset();
    this.resetDetailedQuality();
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
   * Get the last valid results - always returns null
   * Forces fresh measurements without reference values
   */
  public getLastValidResults(): VitalSignsResult | null {
    return null; // Always return null to ensure measurements start from zero
  }
  
  /**
   * Completely reset the processor
   */
  public fullReset(): void {
    this.reset();
    console.log("VitalSignsProcessor: Full reset completed - starting from zero");
  }

  // --- NEW: Method to calculate detailed quality ---
  private calculateDetailedQuality(
      ppgValues: number[],
      rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): void {
      const recentSignal = ppgValues.slice(-60); // Use last ~2 seconds
      if (recentSignal.length < 30) {
          this.resetDetailedQuality();
          return;
      }

      let cardiacScore = 0;
      let ppgScore = 0;

      // 1. Calculate AC/DC (Perfusion Index proxy)
      const dc = recentSignal.reduce((sum, val) => sum + val, 0) / recentSignal.length;
      const ac = Math.max(...recentSignal) - Math.min(...recentSignal);
      const perfusionIndex = dc > 0 ? ac / dc : 0;

      // 2. Signal Stability/Noise (Standard Deviation)
      const stdDev = calculateStandardDeviation(recentSignal);

      // 3. Peak Regularity (if RR data available)
      let rrStdDev = -1; // Use -1 to indicate not available
      if (rrData && rrData.intervals && rrData.intervals.length >= 5) {
          rrStdDev = calculateStandardDeviation(rrData.intervals.slice(-5));
      }

      // --- Scoring Logic (Example - Needs Tuning) ---
      // PPG Stability Score (based on PI and noise)
      const piScore = Math.min(100, Math.max(0, perfusionIndex * 500)); // Scale PI
      const noiseScore = Math.max(0, 100 - (stdDev * 1000)); // Penalize high std dev
      ppgScore = Math.round((piScore * 0.6) + (noiseScore * 0.4));

      // Cardiac Clarity Score (based on amplitude, peak regularity)
      const amplitudeScore = Math.min(100, Math.max(0, ac * 2000)); // Scale AC
      let regularityScore = 0;
      if (rrStdDev >= 0) {
          regularityScore = Math.max(0, 100 - (rrStdDev / 10)); // Penalize high RR variation
      } else {
          regularityScore = 50; // Default if no RR data
      }
      cardiacScore = Math.round((amplitudeScore * 0.5) + (regularityScore * 0.5));

       // Calculate Overall Quality (example: weighted average)
       const overallQuality = Math.round((cardiacScore * 0.4) + (ppgScore * 0.6));

      this.detailedQuality = {
          cardiacClarity: isNaN(cardiacScore) ? 0 : cardiacScore,
          ppgStability: isNaN(ppgScore) ? 0 : ppgScore,
          overallQuality: isNaN(overallQuality) ? 0 : overallQuality,
      };

      // console.log("[Detailed Quality]:", this.detailedQuality);
  }

  // --- NEW: Method to get detailed quality ---
  public getDetailedQuality(): DetailedSignalQuality {
      return this.detailedQuality;
  }

  // --- NEW: Helper to reset detailed quality ---
  private resetDetailedQuality(fullReset = true): void {
      if (fullReset || (this.detailedQuality.cardiacClarity === 0 && this.detailedQuality.ppgStability === 0)){
         this.detailedQuality = { cardiacClarity: 0, ppgStability: 0, overallQuality: 0 };
      }
      // Optionally keep the last known values briefly if !fullReset?
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
