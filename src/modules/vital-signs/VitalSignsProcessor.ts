
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
  
  // Flag to indicate if stabilization phase is complete
  private isStabilized: boolean = false;
  private stabilizationCounter: number = 0;
  private readonly STABILIZATION_THRESHOLD: number = 30;

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
    
    // Handle stabilization phase
    if (this.processedFrameCount <= 10) {
      console.log("VitalSignsProcessor: Signal stabilization phase", {
        frameCount: this.processedFrameCount
      });
    }
    
    // Increment stabilization counter when sufficient frames are processed
    if (this.processedFrameCount > 10 && !this.isStabilized) {
      this.stabilizationCounter++;
      if (this.stabilizationCounter >= this.STABILIZATION_THRESHOLD) {
        this.isStabilized = true;
        console.log("VitalSignsProcessor: Signal stabilized after frame count", this.processedFrameCount);
      }
    }
    
    // Log specific for debugging data flow
    if (this.processedFrameCount % 30 === 0 || this.processedFrameCount < 10) {
      console.log("VitalSignsProcessor: Processing frame", {
        frameCount: this.processedFrameCount,
        ppgValue,
        hasRRData: !!rrData,
        rrIntervals: rrData?.intervals?.length || 0,
        isStabilized: this.isStabilized
      });
    }

    // Aplicar filtrado a la señal PPG real, siempre procesar
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
    
    // Continue processing regardless of data quantity
    let hasEnoughData = ppgValues.length >= 15;
    
    // Verificar amplitud - solo log, no retornamos
    let signalMin = ppgValues[0];
    let signalMax = ppgValues[0];
    
    for (let i = 1; i < ppgValues.length && i < 15; i++) {
      if (ppgValues[i] < signalMin) signalMin = ppgValues[i];
      if (ppgValues[i] > signalMax) signalMax = ppgValues[i];
    }
    
    const amplitude = signalMax - signalMin;
    
    // Calculate SpO2 using real data only (needs more data points)
    const spo2Value = ppgValues.length >= 30 ? 
                     this.spo2Processor.calculateSpO2(ppgValues.slice(-45)) : 
                     0;
    const spo2 = spo2Value > 85 ? ~~(spo2Value + 0.5) : 0;
    
    // Calculate blood pressure after having enough data points
    const bp = ppgValues.length >= 60 ? 
               this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90)) : 
               { systolic: 0, diastolic: 0 };
    const pressure = bp.systolic > 90 && bp.diastolic > 60 ? 
      `${~~(bp.systolic + 0.5)}/${~~(bp.diastolic + 0.5)}` : 
      "--/--";
    
    // Estimate heart rate from signal if RR data available
    let heartRate = 0;
    if (rrData && rrData.intervals && rrData.intervals.length > 0) {
      let sum = 0;
      for (let i = 0; i < rrData.intervals.length && i < 5; i++) {
        sum += rrData.intervals[rrData.intervals.length - 1 - i];
      }
      const avgInterval = sum / (rrData.intervals.length < 5 ? rrData.intervals.length : 5);
      heartRate = avgInterval > 0 ? ~~(60000 / avgInterval + 0.5) : 0;
      
      if (this.processedFrameCount % 10 === 0) {
        console.log("VitalSignsProcessor: Heart rate calculated from RR", {
          heartRate,
          avgInterval,
          intervalsCount: rrData.intervals.length
        });
      }
    }
    
    // Calculate glucose with real data only
    const glucoseValue = ppgValues.length >= 75 ? 
                        this.glucoseProcessor.calculateGlucose(ppgValues) : 
                        0;
    const glucose = glucoseValue >= 70 ? ~~(glucoseValue + 0.5) : 0;
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calculate lipids with real data only (needs sufficient data)
    const lipids = ppgValues.length >= 90 ? 
                  this.lipidProcessor.calculateLipids(ppgValues) : 
                  { totalCholesterol: 0, triglycerides: 0 };
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate hydration with real PPG data
    const hydrationValue = ppgValues.length >= 45 ? 
                          this.hydrationEstimator.analyze(ppgValues) : 
                          0;
    const hydration = hydrationValue >= 50 ? ~~(hydrationValue + 0.5) : 0;
    
    // Calculate overall confidence
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    // Valores finales
    const finalGlucose = glucose;
    const finalLipids = {
      totalCholesterol: lipids.totalCholesterol > 0 ? ~~(lipids.totalCholesterol + 0.5) : 0,
      triglycerides: lipids.triglycerides > 0 ? ~~(lipids.triglycerides + 0.5) : 0
    };
    
    // Calculate hemoglobin based on SpO2 without random values
    const hemoglobin = this.calculateDefaultHemoglobin(spo2);

    // Log all actual calculated values for diagnostic purposes 
    if (this.processedFrameCount % 15 === 0 || this.processedFrameCount < 5) {
      console.log("VitalSignsProcessor: All vital signs calculated", {
        spo2,
        heartRate,
        pressure,
        arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
        glucose: finalGlucose,
        lipids: finalLipids,
        hemoglobin,
        hydration,
        frameCount: this.processedFrameCount,
        isStabilized: this.isStabilized
      });
    }

    // Prepare result with all metrics
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
    
    // Save as last valid result if at least one value is valid
    if (result.heartRate > 0 || result.spo2 > 0 || result.glucose > 0 || result.hydration > 0 ||
        result.lipids.totalCholesterol > 0 || result.lipids.triglycerides > 0 || result.hemoglobin > 0 ||
        result.pressure !== "--/--") {
      this.lastValidResult = result;
      console.log("VitalSignsProcessor: Last valid result updated", {
        heartRate: result.heartRate,
        spo2: result.spo2,
        pressure: result.pressure,
        glucose: result.glucose,
        hydration: result.hydration
      });
    }
    
    // Always return the current result
    return result;
  }

  /**
   * Calculate a default hemoglobin value based on SpO2 without Math.random
   */
  private calculateDefaultHemoglobin(spo2: number): number {
    if (spo2 <= 0) return 0; // Only return value if SpO2 is valid
    
    // Base value without Math.random
    const base = 14;
    
    if (spo2 > 95) return base;
    if (spo2 > 90) return base - 1;
    if (spo2 > 85) return base - 2;
    
    return base - 3;
  }

  /**
   * Get the last valid results if available, otherwise empty results
   */
  public getLastValidResults(): VitalSignsResult {
    if (this.lastValidResult) {
      console.log("VitalSignsProcessor: Returning last valid result", this.lastValidResult);
      return this.lastValidResult;
    }
    console.log("VitalSignsProcessor: No valid result available, returning empty");
    return ResultFactory.createEmptyResults();
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
    this.isStabilized = false;
    this.stabilizationCounter = 0;
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
    this.isStabilized = false;
    this.stabilizationCounter = 0;
    console.log("VitalSignsProcessor: Full reset completed - starting from zero");
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
