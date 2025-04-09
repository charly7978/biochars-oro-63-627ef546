
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SpO2Processor } from './vital-signs/spo2-processor';
import { BloodPressureProcessor } from './vital-signs/blood-pressure-processor';
import { ArrhythmiaProcessor } from './vital-signs/arrhythmia-processor';
import { SignalProcessor } from './vital-signs/signal-processor';
import { GlucoseProcessor } from './vital-signs/glucose-processor';
import { LipidProcessor } from './vital-signs/lipid-processor';
import { ResultFactory } from './vital-signs/factories/result-factory';
import { SignalValidator } from './vital-signs/validators/signal-validator';
import { ConfidenceCalculator } from './vital-signs/calculators/confidence-calculator';
import { VitalSignsResult } from './vital-signs/types/vital-signs-result';

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
  
  // Validators and calculators
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;
  
  // Debug and logging
  private lastRawValue: number = 0;
  private processingCount: number = 0;

  /**
   * Constructor that initializes all specialized processors
   * Using only direct measurement - NO SIMULATION
   */
  constructor() {
    console.log("VitalSignsProcessor: Inicializando nueva instancia para MEDICIÓN DIRECTA únicamente");
    
    // Initialize specialized processors for DIRECT MEASUREMENT
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    
    // Initialize validators and calculators with STRICTER thresholds for real signals
    this.signalValidator = new SignalValidator(0.008, 12);
    this.confidenceCalculator = new ConfidenceCalculator(0.12);
  }
  
  /**
   * Processes the real PPG signal and calculates all vital signs
   * Using ONLY direct measurements with no reference values or simulation
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    this.lastRawValue = ppgValue;
    this.processingCount++;
    
    // Log every 5th sample for debugging
    if (this.processingCount % 5 === 0) {
      console.log("VitalSignsProcessor: Procesando señal REAL", {
        value: ppgValue,
        muestra: this.processingCount,
        timestamp: new Date().toISOString(),
        tieneRRData: !!rrData,
        intervalosRR: rrData?.intervals?.length || 0
      });
    }
    
    // Check for near-zero signal
    if (!this.signalValidator.isValidSignal(ppgValue)) {
      if (this.processingCount % 10 === 0) {
        console.log("VitalSignsProcessor: Señal demasiado débil, devolviendo valores neutros", { value: ppgValue });
      }
      return ResultFactory.createEmptyResults();
    }
    
    // Apply filtering to the real PPG signal - NO SIMULATION
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Process arrhythmia data if available and valid - REAL DATA ONLY
    const arrhythmiaResult = rrData && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    // Get PPG values for processing - REAL DATA ONLY
    const ppgValues = this.signalProcessor.getPPGValues();
    ppgValues.push(filtered);
    
    // Limit the real data buffer
    if (ppgValues.length > 300) {
      ppgValues.splice(0, ppgValues.length - 300);
    }
    
    // Check if we have enough data points for REAL processing
    if (!this.signalValidator.hasEnoughData(ppgValues)) {
      if (this.processingCount % 10 === 0) {
        console.log("VitalSignsProcessor: Datos insuficientes para análisis", { 
          bufferedValues: ppgValues.length
        });
      }
      return ResultFactory.createEmptyResults();
    }
    
    // Verify real signal amplitude is sufficient
    const signalMin = Math.min(...ppgValues.slice(-15));
    const signalMax = Math.max(...ppgValues.slice(-15));
    const amplitude = signalMax - signalMin;
    
    if (!this.signalValidator.hasValidAmplitude(ppgValues)) {
      if (this.processingCount % 10 === 0) {
        this.signalValidator.logValidationResults(false, amplitude, ppgValues);
      }
      return ResultFactory.createEmptyResults();
    }
    
    // Calculate SpO2 using real PPG data
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-45));
    
    // Calculate blood pressure using real signal characteristics
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // Calculate glucose with real data
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calculate lipids with real data
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate overall confidence based on real signal
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    // Only show values if confidence exceeds threshold
    const finalGlucose = this.confidenceCalculator.meetsThreshold(glucoseConfidence) ? glucose : 0;
    const finalLipids = this.confidenceCalculator.meetsThreshold(lipidsConfidence) ? lipids : {
      totalCholesterol: 0,
      triglycerides: 0
    };

    if (this.processingCount % 10 === 0) {
      console.log("VitalSignsProcessor: Resultados de mediciones REALES", {
        spo2,
        pressure,
        arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
        glucose: finalGlucose,
        lipids: finalLipids,
        signalAmplitude: amplitude,
        confidence: overallConfidence
      });
    }

    // Prepare result with all metrics from REAL measurements
    return ResultFactory.createResult(
      spo2,
      pressure,
      arrhythmiaResult.arrhythmiaStatus,
      finalGlucose,
      finalLipids,
      {
        glucose: glucoseConfidence,
        lipids: lipidsConfidence,
        overall: overallConfidence
      },
      arrhythmiaResult.lastArrhythmiaData
    );
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
    console.log("VitalSignsProcessor: Reset completo - todos los procesadores reiniciados");
    return null; // Always return null to ensure measurements start from zero
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount();
  }
  
  /**
   * Get the last valid results - no caching to ensure real measurements
   */
  public getLastValidResults(): VitalSignsResult | null {
    return null;
  }
  
  /**
   * Completely reset the processor for fresh measurements
   */
  public fullReset(): void {
    this.reset();
    this.processingCount = 0;
    this.lastRawValue = 0;
    console.log("VitalSignsProcessor: Reset completo - preparado para nuevas mediciones reales");
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './vital-signs/types/vital-signs-result';
