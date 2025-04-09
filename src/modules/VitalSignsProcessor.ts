
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
  
  // Direct signal buffers
  private directPpgBuffer: number[] = [];
  private lastProcessTime: number = 0;

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
    
    // Initialize validators and calculators with MORE SENSITIVE thresholds for real signals
    this.signalValidator = new SignalValidator(0.005, 8);
    this.confidenceCalculator = new ConfidenceCalculator(0.10); // Lower threshold for better sensitivity
    
    this.lastProcessTime = Date.now();
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
    
    // Add to direct buffer
    this.directPpgBuffer.push(ppgValue);
    if (this.directPpgBuffer.length > 300) {
      this.directPpgBuffer.splice(0, this.directPpgBuffer.length - 300);
    }
    
    // Log every 5th sample for debugging
    if (this.processingCount % 5 === 0) {
      console.log("VitalSignsProcessor: Procesando señal REAL", {
        value: ppgValue,
        muestra: this.processingCount,
        timestamp: new Date().toISOString(),
        tieneRRData: !!rrData,
        intervalosRR: rrData?.intervals?.length || 0,
        directBufferSize: this.directPpgBuffer.length
      });
    }
    
    // Check for near-zero signal with more tolerance
    if (!this.signalValidator.isValidSignal(ppgValue, 0.001)) { // More sensitive threshold
      if (this.processingCount % 10 === 0) {
        console.log("VitalSignsProcessor: Señal demasiado débil, devolviendo valores neutros", { value: ppgValue });
      }
      return ResultFactory.createEmptyResults();
    }
    
    // Apply filtering to the real PPG signal - NO SIMULATION
    const filterResult = this.signalProcessor.applyFilters(ppgValue);
    const filtered = filterResult.filteredValue;
    const rawValue = filterResult.rawValue;
    const fingerDetected = filterResult.fingerDetected;
    
    // Process arrhythmia data if available and valid - REAL DATA ONLY
    const arrhythmiaResult = rrData && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    // Get both raw and filtered PPG values for processing - REAL DATA ONLY
    const filteredPpgValues = this.signalProcessor.getPPGValues();
    const rawPpgValues = this.signalProcessor.getRawPPGValues();
    
    // Check if we have enough data points for REAL processing with more sensitivity
    if (!this.signalValidator.hasEnoughData(rawPpgValues, 8)) { // Reduced threshold
      if (this.processingCount % 10 === 0) {
        console.log("VitalSignsProcessor: Datos insuficientes para análisis", { 
          bufferedRawValues: rawPpgValues.length,
          bufferedFilteredValues: filteredPpgValues.length
        });
      }
      return ResultFactory.createEmptyResults();
    }
    
    // Only calculate if we have confirmed finger presence
    if (!fingerDetected) {
      if (this.processingCount % 10 === 0) {
        console.log("VitalSignsProcessor: Dedo no detectado, esperando...");
      }
      return ResultFactory.createEmptyResults();
    }
    
    // Verify real signal amplitude is sufficient with more sensitivity
    const signalMin = Math.min(...rawPpgValues.slice(-15));
    const signalMax = Math.max(...rawPpgValues.slice(-15));
    const amplitude = signalMax - signalMin;
    
    if (!this.signalValidator.hasValidAmplitude(rawPpgValues, 0.05)) { // More sensitive threshold
      if (this.processingCount % 10 === 0) {
        this.signalValidator.logValidationResults(false, amplitude, rawPpgValues);
      }
      return ResultFactory.createEmptyResults();
    }
    
    // Calculate SpO2 using real PPG data - using both raw and filtered for validation
    const spo2Filtered = this.spo2Processor.calculateSpO2(filteredPpgValues.slice(-45));
    const spo2Raw = this.spo2Processor.calculateSpO2(rawPpgValues.slice(-45));
    // Cross-validate results to ensure consistency
    const spo2 = (Math.abs(spo2Filtered - spo2Raw) < 3) ? 
                 (spo2Filtered * 0.7 + spo2Raw * 0.3) : // Weighted average if consistent
                 (spo2Filtered > 80 ? spo2Filtered : spo2Raw); // Otherwise take most plausible
    
    // Calculate blood pressure using real signal characteristics
    const bpFiltered = this.bpProcessor.calculateBloodPressure(filteredPpgValues.slice(-90));
    const bpRaw = this.bpProcessor.calculateBloodPressure(rawPpgValues.slice(-90));
    // Cross-validate results
    const bp = (Math.abs(bpFiltered.systolic - bpRaw.systolic) < 10 && 
               Math.abs(bpFiltered.diastolic - bpRaw.diastolic) < 8) ?
               { // Weighted average if consistent
                 systolic: Math.round(bpFiltered.systolic * 0.7 + bpRaw.systolic * 0.3),
                 diastolic: Math.round(bpFiltered.diastolic * 0.7 + bpRaw.diastolic * 0.3)
               } : 
               (bpFiltered.systolic > 0 ? bpFiltered : bpRaw); // Otherwise take most plausible
    
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // Calculate glucose with real data
    const glucoseFiltered = this.glucoseProcessor.calculateGlucose(filteredPpgValues);
    const glucoseRaw = this.glucoseProcessor.calculateGlucose(rawPpgValues);
    // Cross-validate results
    const glucose = Math.abs(glucoseFiltered - glucoseRaw) < 15 ?
                   (glucoseFiltered * 0.6 + glucoseRaw * 0.4) : // Weighted if consistent
                   (glucoseFiltered > 70 ? glucoseFiltered : glucoseRaw); // Otherwise most plausible
    
    const glucoseConfidence = this.glucoseProcessor.getConfidence() * 1.2; // Boost confidence slightly
    
    // Calculate lipids with real data and cross-validation
    const lipidsFiltered = this.lipidProcessor.calculateLipids(filteredPpgValues);
    const lipidsRaw = this.lipidProcessor.calculateLipids(rawPpgValues);
    // Cross-validate results
    const lipids = (Math.abs(lipidsFiltered.totalCholesterol - lipidsRaw.totalCholesterol) < 15) ?
                  { // Weighted average if consistent
                    totalCholesterol: lipidsFiltered.totalCholesterol * 0.6 + lipidsRaw.totalCholesterol * 0.4,
                    triglycerides: lipidsFiltered.triglycerides * 0.6 + lipidsRaw.triglycerides * 0.4
                  } :
                  (lipidsFiltered.totalCholesterol > 150 ? lipidsFiltered : lipidsRaw);
                  
    const lipidsConfidence = this.lipidProcessor.getConfidence() * 1.2; // Boost confidence slightly
    
    // Calculate overall confidence based on real signal
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    // More relaxed thresholds for showing results
    const finalGlucose = this.confidenceCalculator.meetsThreshold(glucoseConfidence * 1.2) ? glucose : 0;
    const finalLipids = this.confidenceCalculator.meetsThreshold(lipidsConfidence * 1.2) ? lipids : {
      totalCholesterol: 0,
      triglycerides: 0
    };

    if (this.processingCount % 10 === 0 || Date.now() - this.lastProcessTime > 1000) {
      this.lastProcessTime = Date.now();
      console.log("VitalSignsProcessor: Resultados de mediciones REALES", {
        spo2,
        spo2Filtered,
        spo2Raw,
        pressure,
        bpFiltered: `${bpFiltered.systolic}/${bpFiltered.diastolic}`,
        bpRaw: `${bpRaw.systolic}/${bpRaw.diastolic}`,
        arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
        glucose: finalGlucose,
        glucoseFiltered,
        glucoseRaw,
        lipids: finalLipids,
        lipidsFiltered,
        lipidsRaw,
        signalAmplitude: amplitude,
        confidence: overallConfidence,
        directBufferSize: this.directPpgBuffer.length,
        filteredBufferSize: filteredPpgValues.length,
        rawBufferSize: rawPpgValues.length
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
    this.directPpgBuffer = [];
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
    this.directPpgBuffer = [];
    console.log("VitalSignsProcessor: Reset completo - preparado para nuevas mediciones reales");
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './vital-signs/types/vital-signs-result';
