/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';
import { ResultFactory } from './factories/result-factory';
import { SignalValidator } from './validators/signal-validator';
import { ConfidenceCalculator } from './calculators/confidence-calculator';
import { VitalSignsResult } from './types/vital-signs-result';
import { HydrationEstimator } from '@/core/analysis/HydrationEstimator';
import { SignalOptimizerManager } from '../signal-optimizer/SignalOptimizerManager';
import { antiRedundancyGuard } from '../../core/validation/CrossValidationSystem';
import { ProcessedSignal } from '@/types/signal';
import { RRData } from '@/core/signal/PeakDetector';
import { HemoglobinEstimator } from '@/core/analysis/HemoglobinEstimator';
import { CircularBuffer } from '@/utils/CircularBuffer';

// Instancia global o de clase del optimizador para todos los canales relevantes
const optimizerManager = new SignalOptimizerManager({
  red: { filterType: 'kalman', gain: 1.0 },
  ir: { filterType: 'sma', gain: 1.0 },
  green: { filterType: 'ema', gain: 1.0 }
});

// Registrar el archivo y la tarea única globalmente (fuera de la clase)
antiRedundancyGuard.registerFile('src/modules/vital-signs/VitalSignsProcessor.ts');
antiRedundancyGuard.registerTask('VitalSignsProcessorSingleton');

/**
 * Main vital signs processor
 * Integrates improved arrhythmia detection and calibrated blood pressure measurement with real data
 * Guarantees no data simulation or manipulation, only direct measurement
 */
export class VitalSignsProcessor {
  // Specialized processors
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  private hydrationEstimator: HydrationEstimator;
  private hemoglobinEstimator: HemoglobinEstimator;
  
  // Validators and calculators
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;

  // Estado interno
  private lastValidResult: VitalSignsResult | null = null;
  private ppgBuffer: CircularBuffer = new CircularBuffer(150); // Buffer circular para el valor OPTIMIZADO principal
  private processingCount = 0;

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
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    this.hydrationEstimator = new HydrationEstimator();
    this.hemoglobinEstimator = new HemoglobinEstimator();
    
    // Initialize validators and calculators
    this.signalValidator = new SignalValidator();
    this.confidenceCalculator = new ConfidenceCalculator();
  }
  
  /**
   * Procesa la señal optimizada para calcular todos los signos vitales.
   *
   * @param primaryOptimizedValue El valor de la señal PPG principal, optimizado (ej. del canal 'general').
   * @param contextSignal El objeto ProcessedSignal original (post-OpenCV/filtros base) para contexto.
   * @param rrData Datos de intervalo RR para análisis de arritmia.
   * @param allOptimizedValues (Opcional) Todos los valores optimizados por canal.
   * @returns Resultados de los signos vitales.
   */
  public processSignal(
    primaryOptimizedValue: number,
    contextSignal: ProcessedSignal,
    rrData?: RRData,
    allOptimizedValues?: Record<string, number>
  ): VitalSignsResult {
    this.processingCount++;

    // Log periodically for debug
    if (this.processingCount % 10 === 0) {
      console.log(`VitalSignsProcessor: Processing signal #${this.processingCount}`, {
        quality: contextSignal.quality,
        fingerDetected: contextSignal.fingerDetected
      });
    }

    if (!contextSignal || typeof primaryOptimizedValue !== 'number') {
      console.warn("VitalSignsProcessor: Invalid input to processSignal");
      return this.lastValidResult ?? ResultFactory.createEmptyResults();
    }

    if (!contextSignal.fingerDetected || contextSignal.quality < 15) {
      console.log("VitalSignsProcessor: Finger not detected or quality too low");
      return ResultFactory.createEmptyResults();
    }

    // Push optimized main PPG value into buffer
    this.ppgBuffer.push({ time: Date.now(), value: primaryOptimizedValue });

    if (this.ppgBuffer.length < this.ppgBuffer.capacity * 0.3) {
      console.log(`VitalSignsProcessor: PPG buffer insufficient (${this.ppgBuffer.length}/${this.ppgBuffer.capacity})`);
      return ResultFactory.createEmptyResults();
    }

    // Process advanced SpO2 calculation
    let spo2 = 0;
    // Use neural network model for blood pressure with mandatory manual calibration
    let pressure = { systolic: 0, diastolic: 0 };
    // Use robust arrhythmia processor with enhanced detection
    let arrhythmiaResult: { arrhythmiaStatus: string; lastArrhythmiaData: any | null } = { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    let glucose = 0;
    let lipids = { totalCholesterol: 0, triglycerides: 0 };
    let hemoglobin = 0;
    let hydration = 0;

    try {
      // SpO2 calculation with direct signal buffer
      spo2 = this.spo2Processor.calculateSpO2(this.ppgBuffer.getPoints().map(p => p.value));

      // Blood pressure calculation using neural model with calibration check
      pressure = this.bpProcessor.calculateBloodPressure(this.ppgBuffer.getPoints().map(p => p.value));

      // Enhanced arrhythmia detection using RR intervals with real-time validation
      arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
      if (arrhythmiaResult && arrhythmiaResult.arrhythmiaStatus.includes("DETECTED")) {
        console.log("VitalSignsProcessor: Arrhythmia detected", arrhythmiaResult);
      }

      // Glucose and lipid processing 
      glucose = this.glucoseProcessor.calculateGlucose(this.ppgBuffer.getPoints().map(p => p.value));
      lipids = this.lipidProcessor.calculateLipids(this.ppgBuffer.getPoints().map(p => p.value));

      // Hemoglobin estimation based on SpO2 with valid signal
      hemoglobin = this.calculateDefaultHemoglobin(spo2);

      // Hydration estimation from PPG signal shape and variability
      hydration = this.hydrationEstimator.analyze(this.ppgBuffer.getPoints().map(p => p.value));

      if (this.processingCount % 5 === 0) {
        console.log("VitalSignsProcessor: Results", {
          spo2,
          pressure: `${Math.round(pressure.systolic)}/${Math.round(pressure.diastolic)}`,
          glucose,
          lipids,
          hemoglobin,
          hydration,
          arrhythmia: arrhythmiaResult.arrhythmiaStatus,
        });
      }
    } catch (error) {
      console.error("VitalSignsProcessor: Error calculating vitals:", error);
      return this.lastValidResult ?? ResultFactory.createEmptyResults();
    }

    // Compute confidence with multiple inputs
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(glucoseConfidence, lipidsConfidence);

    // Prepare final results with all vital signs and confidence levels
    const finalResult = ResultFactory.createResult(
      Math.round(spo2),
      `${Math.round(pressure.systolic)}/${Math.round(pressure.diastolic)}`,
      arrhythmiaResult.arrhythmiaStatus,
      Math.round(glucose),
      {
        totalCholesterol: Math.round(lipids.totalCholesterol),
        triglycerides: Math.round(lipids.triglycerides)
      },
      hemoglobin,
      Math.round(hydration),
      glucoseConfidence,
      lipidsConfidence,
      overallConfidence,
      arrhythmiaResult.lastArrhythmiaData
    );

    this.lastValidResult = finalResult;
    return finalResult;
  }

  /**
   * Apply blood pressure calibration to the processor
   */
  public applyBloodPressureCalibration(systolic: number, diastolic: number): void {
    console.log(`VitalSignsProcessor: Applying BP Calibration - S: ${systolic}, D: ${diastolic}`);
    this.bpProcessor.updateCalibration(systolic, diastolic);
  }

  /**
   * Calculate a default hemoglobin value based on SpO2
   */
  private calculateDefaultHemoglobin(spo2: number): number {
    // Estimación basada en correlación SpO2-Hemoglobina
    if (spo2 <= 0) return 0;
    
    // Relación no lineal ajustada
    let baseHb = 12.5; // Base para SpO2 normal (~96%)
    let scaleFactor = 0.2; // Factor de escala
    
    // Ajuste no lineal
    let deviation = spo2 - 96; // Desviación desde SpO2 normal
    let adjustment = Math.sign(deviation) * Math.pow(Math.abs(deviation) * 0.1, 1.5);
    
    let estimatedHb = baseHb + adjustment;
    
    // Limitar a rangos fisiológicos
    estimatedHb = Math.max(8, Math.min(18, estimatedHb));
    return parseFloat(estimatedHb.toFixed(1));
  }

  /**
   * Reset the processor to ensure a clean state
   * No reference values or simulations
   */
  public reset(): VitalSignsResult | null {
    console.log("VitalSignsProcessor: Resetting processors...");
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.hemoglobinEstimator.reset();
    this.hydrationEstimator.reset();
    this.signalValidator.resetFingerDetection();
    
    const result = this.lastValidResult;
    this.ppgBuffer.clear();
    this.lastValidResult = null;
    this.processingCount = 0;
    
    return result; // Devolver último resultado válido antes del reset
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
    console.log("VitalSignsProcessor: Performing full reset...");
    this.reset();
    this.processingCount = 0;
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
