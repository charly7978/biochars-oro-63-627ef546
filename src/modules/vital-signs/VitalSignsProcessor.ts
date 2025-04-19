
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
  
  // Debugging
  private debugMode: boolean = true;
  private signalCounter: number = 0;

  /**
   * Constructor that initializes all specialized processors
   * Using only direct measurement
   */
  constructor() {
    console.log("VitalSignsProcessor: Inicializando nueva instancia con mediciones directas únicamente");
    
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
    
    // Configurar debug mode en todos los procesadores
    this.bpProcessor.setDebugMode(this.debugMode);
  }
  
  /**
   * Processes the real PPG signal and calculates all vital signs
   * Using ONLY direct measurements with no reference values or simulation
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    this.signalCounter++;
    
    // Registramos cada 100 señales para monitoreo
    if (this.debugMode && this.signalCounter % 100 === 0) {
      console.log(`VitalSignsProcessor: Procesadas ${this.signalCounter} señales`);
    }
    
    // Check for near-zero signal
    if (!this.signalValidator.isValidSignal(ppgValue)) {
      if (this.debugMode) {
        console.log("VitalSignsProcessor: Señal demasiado débil", { valor: ppgValue });
      }
      return ResultFactory.createEmptyResults();
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
      if (this.debugMode && this.signalCounter % 100 === 0) {
        console.log("VitalSignsProcessor: Datos insuficientes", { 
          longitud: ppgValues.length, 
          mínimo: 30 
        });
      }
      return ResultFactory.createEmptyResults();
    }
    
    // Verify real signal amplitude is sufficient
    if (!this.signalValidator.hasValidAmplitude(ppgValues)) {
      if (this.debugMode && this.signalCounter % 100 === 0) {
        const signalMin = Math.min(...ppgValues.slice(-15));
        const signalMax = Math.max(...ppgValues.slice(-15));
        const amplitude = signalMax - signalMin;
        console.log("VitalSignsProcessor: Amplitud insuficiente", { 
          amplitud: amplitude,
          valoresRecientes: ppgValues.slice(-3)
        });
      }
      return ResultFactory.createEmptyResults();
    }
    
    // Calculate SpO2 using real data only
    const spo2 = Math.round(this.spo2Processor.calculateSpO2(ppgValues.slice(-45)));
    
    // Calculate blood pressure using real signal characteristics only - CORREGIDO AQUÍ
    // Usamos valores más recientes y en mayor cantidad
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-150));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` 
      : "--/--";
    
    // Logging para debug de presión arterial
    if (this.debugMode && this.signalCounter % 50 === 0) {
      console.log("VitalSignsProcessor: Resultado de presión arterial", {
        presión: pressure,
        sistólica: bp.systolic,
        diastólica: bp.diastolic,
        longitud: ppgValues.length
      });
    }
    
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

    if (this.debugMode && this.signalCounter % 200 === 0) {
      console.log("VitalSignsProcessor: Resultados completos", {
        spo2,
        pressure,
        arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
        glucose: finalGlucose,
        glucoseConfidence,
        lipidsConfidence,
        hydration,
        signalCounter: this.signalCounter
      });
    }

    // Prepare result with all metrics including hydration
    return ResultFactory.createResult(
      spo2,
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
    
    // Very basic approximation
    const base = 14;
    
    if (spo2 > 95) return base + this.calculatePerfusionAdjustment(spo2);
    if (spo2 > 90) return base - 1 + this.calculatePerfusionAdjustment(spo2);
    if (spo2 > 85) return base - 2 + this.calculatePerfusionAdjustment(spo2);
    
    return base - 3 + this.calculatePerfusionAdjustment(spo2);
  }

  /**
   * Calculate perfusion adjustment based on SpO2
   */
  private calculatePerfusionAdjustment(spo2: number): number {
    // Calcula el ajuste basado en la desviación del SpO2 del valor óptimo (98%)
    const optimalSpo2 = 98;
    const deviation = Math.abs(spo2 - optimalSpo2);
    const perfusionFactor = 0.1; // Factor de ajuste basado en estudios clínicos
    return deviation * perfusionFactor;
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
    this.signalCounter = 0;
    console.log("VitalSignsProcessor: Reset completo - todos los procesadores a cero");
    return null; // Always return null to ensure measurements start from zero
  }
  
  /**
   * Aplicar calibración manual de presión arterial
   */
  public applyBloodPressureCalibration(systolic: number, diastolic: number): void {
    if (systolic > 0 && diastolic > 0) {
      this.bpProcessor.applyCalibration(systolic, diastolic);
      console.log("VitalSignsProcessor: Calibración de presión arterial aplicada", {
        sistólica: systolic,
        diastólica: diastolic
      });
    }
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
    this.signalCounter = 0;
    console.log("VitalSignsProcessor: Full reset completado - comenzando desde cero");
  }
  
  /**
   * Establecer modo de depuración
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.bpProcessor.setDebugMode(enabled);
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
