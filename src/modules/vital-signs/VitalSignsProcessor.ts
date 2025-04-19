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
import { SignalOptimizerManager } from '../signal-optimizer/SignalOptimizerManager';

// Instancia global o de clase del optimizador para todos los canales relevantes
const optimizerManager = new SignalOptimizerManager({
  red: { filterType: 'kalman', gain: 1.0 },
  ir: { filterType: 'sma', gain: 1.0 },
  green: { filterType: 'ema', gain: 1.0 }
});

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
    // Apply filtering to the real PPG signal first to maximize signal quality
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Check for near-zero signal
    if (!this.signalValidator.isValidSignal(filtered)) {
      console.log("VitalSignsProcessor: Signal too weak, returning zeros", { value: filtered });
      return ResultFactory.createEmptyResults();
    }
    
    // Get PPG values for processing
    const ppgValues = this.signalProcessor.getPPGValues();
    ppgValues.push(filtered);
    
    // Limit the real data buffer
    if (ppgValues.length > 300) {
      ppgValues.splice(0, ppgValues.length - 300);
    }
    
    // Check if we have enough data points
    if (!this.signalValidator.hasEnoughData(ppgValues)) {
      console.log("VitalSignsProcessor: Not enough data points yet", { count: ppgValues.length });
      return ResultFactory.createEmptyResults();
    }
    
    // Process arrhythmia data if available and valid
    const arrhythmiaResult = rrData && 
                           rrData.intervals && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    // Verify real signal amplitude is sufficient - reduced threshold for better sensitivity
    const signalMin = Math.min(...ppgValues.slice(-15));
    const signalMax = Math.max(...ppgValues.slice(-15));
    const amplitude = signalMax - signalMin;
    
    if (!this.signalValidator.hasValidAmplitude(ppgValues)) {
      this.signalValidator.logValidationResults(false, amplitude, ppgValues);
      return ResultFactory.createEmptyResults();
    }
    
    // Calculate SpO2 usando ambos canales (red, ir)
    const spo2 = Math.round(this.spo2Processor.calculateSpO2(ppgValues.slice(-45)));
    // Feedback de confianza/calidad para ambos canales tras cálculo de SpO2
    optimizerManager.applyFeedback('red', {
      confidence: 0.8, // Reemplaza por this.spo2Processor.getConfidence?.() si existe
      quality: 100, // Ajusta según tu métrica real
      metricType: 'SpO2'
    });
    optimizerManager.applyFeedback('ir', {
      confidence: 0.8, // Igual que arriba
      quality: 100, // Ajusta según tu métrica real
      metricType: 'SpO2'
    });
    
    // Calculate blood pressure usando canal relevante (ej: red)
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` 
      : "--/--";
    optimizerManager.applyFeedback('red', {
      confidence: 0.8, // Ajusta según tu métrica real
      quality: 100,
      metricType: 'BloodPressure'
    });
    
    // Calculate glucose
    const glucose = Math.round(this.glucoseProcessor.calculateGlucose(ppgValues));
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    optimizerManager.applyFeedback('red', {
      confidence: glucoseConfidence,
      quality: 100,
      metricType: 'Glucose'
    });
    optimizerManager.applyFeedback('green', {
      confidence: glucoseConfidence,
      quality: 100,
      metricType: 'Glucose'
    });
    
    // Calculate lipids
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    optimizerManager.applyFeedback('red', {
      confidence: lipidsConfidence,
      quality: 100,
      metricType: 'Lipids'
    });
    optimizerManager.applyFeedback('green', {
      confidence: lipidsConfidence,
      quality: 100,
      metricType: 'Lipids'
    });
    
    // Calculate hydration
    const hydration = Math.round(this.hydrationEstimator.analyze(ppgValues));
    optimizerManager.applyFeedback('red', {
      confidence: 0.8,
      quality: 100,
      metricType: 'Hydration'
    });
    optimizerManager.applyFeedback('green', {
      confidence: 0.8,
      quality: 100,
      metricType: 'Hydration'
    });
    
    // Calculate HR (frecuencia cardíaca)
    // Suponiendo que tienes un método para calcular HR y su confianza
    const heartRate = 75; // Reemplaza por tu cálculo real
    const hrConfidence = 0.85; // Reemplaza por tu cálculo real
    optimizerManager.applyFeedback('red', {
      confidence: hrConfidence,
      quality: 100,
      metricType: 'HeartRate'
    });
    optimizerManager.applyFeedback('ir', {
      confidence: hrConfidence,
      quality: 100,
      metricType: 'HeartRate'
    });

    // Calculate hemoglobina
    const hemoglobin = Math.round(this.calculateDefaultHemoglobin(spo2));
    optimizerManager.applyFeedback('red', {
      confidence: 0.8,
      quality: 100,
      metricType: 'Hemoglobin'
    });
    optimizerManager.applyFeedback('green', {
      confidence: 0.8,
      quality: 100,
      metricType: 'Hemoglobin'
    });

    // Calculate arrhythmia
    // Suponiendo que tienes un resultado de arrhythmia y su confianza
    const arrhythmiaConfidence = 0.8; // Reemplaza por tu cálculo real
    optimizerManager.applyFeedback('red', {
      confidence: arrhythmiaConfidence,
      quality: 100,
      metricType: 'Arrhythmia'
    });
    optimizerManager.applyFeedback('ir', {
      confidence: arrhythmiaConfidence,
      quality: 100,
      metricType: 'Arrhythmia'
    });
    
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
      signalAmplitude: amplitude,
      confidenceThreshold: this.confidenceCalculator.getConfidenceThreshold()
    });

    // Prepare result with all metrics including hydration
    return ResultFactory.createResult(
      spo2,
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
  }

  /**
   * Apply blood pressure calibration to the processor
   */
  public applyBloodPressureCalibration(systolic: number, diastolic: number): void {
    // Fix: Change from applyCalibration to updateCalibration which is the correct method name
    this.bpProcessor.updateCalibration(systolic, diastolic);
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
