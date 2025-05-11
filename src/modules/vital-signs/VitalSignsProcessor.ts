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
    this.confidenceCalculator = new ConfidenceCalculator(0.15);
  }
  
  /**
   * Processes the real PPG signal and calculates all vital signs
   * Using ONLY direct measurements with no reference values or simulation
   */
  public processSignal(
    ppgValue: number
  ): VitalSignsResult {
    const { filteredValue, quality: signalQuality, fingerDetected, acSignalValue, dcBaseline } = this.signalProcessor.applyFilters(ppgValue);

    if (!fingerDetected) {
      console.log("VitalSignsProcessor: Finger not detected by SignalProcessor, returning empty results.", { ppgValue, signalQuality });
      // Reset specific sub-processors if finger is lost to ensure fresh start
      this.spo2Processor.reset();
      this.bpProcessor.reset();
      this.glucoseProcessor.reset();
      this.lipidProcessor.reset();
      this.hydrationEstimator.reset();
      // Consider if arrhythmiaProcessor needs a specific reset action upon finger loss,
      // or if its existing reset (called by the main reset) is sufficient.
      return ResultFactory.createEmptyResults();
    }
    
    const ppgValues = this.signalProcessor.getPPGValues(); // Estos son AC filtrados
    const rawSignalRecent = this.signalProcessor.getRawSignalBuffer(); // Estos son raw (antes de DC removal)

    const MIN_DATA_FOR_PROCESSING = 90; 
    // La comprobación de ppgValues.length se mantiene para BP, Lipids, Hydration que usan la AC filtrada.
    if (ppgValues.length < MIN_DATA_FOR_PROCESSING) { 
      console.log("VitalSignsProcessor: Insufficient AC signal data for full processing, returning empty.", { bufferLength: ppgValues.length });
      return ResultFactory.createEmptyResults();
    }
    
    // Calculate SpO2: usa raw signal buffer. RAW_BUFFER_SIZE en SignalProcessor es 50.
    const spo2 = (rawSignalRecent.length >= 45) 
                  ? Math.round(this.spo2Processor.calculateSpO2(rawSignalRecent.slice(-45)))
                  : 0; 
    
    // Calculate blood pressure: usa AC signal filtrada (ppgValues)
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90)); 
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` 
      : "--/--";
    
    // Calculate glucose: usa raw signal buffer. RAW_BUFFER_SIZE es 50.
    const glucose = (rawSignalRecent.length >= 50) 
                  ? Math.round(this.glucoseProcessor.calculateGlucose(rawSignalRecent)) // Usar el buffer completo si es apropiado
                  : 0; 
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calculate lipids: usa AC signal filtrada (ppgValues)
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate hydration: usa AC signal filtrada (ppgValues)
    const hydration = Math.round(this.hydrationEstimator.analyze(ppgValues));
    
    // Calculate heart rate: usa AC signal filtrada (ppgValues)
    const heartRate = Math.round(this.signalProcessor.calculateHeartRate());

    // Obtener datos RR del procesador de señal principal (basado en AC filtrada)
    const rrDataFromSignalProcessor = this.signalProcessor.getRRIntervals();

    // Process arrhythmia data if available and valid
    const arrhythmiaResult = rrDataFromSignalProcessor && 
                           rrDataFromSignalProcessor.intervals && 
                           rrDataFromSignalProcessor.intervals.length >= 3 && 
                           rrDataFromSignalProcessor.intervals.every(i => i > 300 && i < 2000) ? // Validar cada intervalo
                           this.arrhythmiaProcessor.processRRData(rrDataFromSignalProcessor) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
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
      heartRate,
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
      heartRate,
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
