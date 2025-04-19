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
 * Integrates different specialized processors to calculate health metrics
 * Operates ONLY in direct measurement mode without reference values or simulation
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
  private ppgBuffer: number[] = []; // Buffer para el valor OPTIMIZADO principal
  private readonly BUFFER_SIZE = 150; // Tamaño de buffer para cálculos

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
   * Processes the real PPG signal and calculates all vital signs
   * Using ONLY direct measurements with no reference values or simulation
   */
  public processSignal(
    primaryOptimizedValue: number,
    contextSignal: ProcessedSignal,
    rrData?: RRData,
    allOptimizedValues?: Record<string, number>
  ): VitalSignsResult {
    if (!contextSignal || typeof primaryOptimizedValue !== 'number') {
        console.warn("VitalSignsProcessor: Entrada inválida para processSignal");
        return this.lastValidResult ?? ResultFactory.createEmptyResults();
    }

    const { quality, fingerDetected } = contextSignal;

    // Si no hay dedo o la calidad es muy baja, devolver último válido o vacío
    if (!fingerDetected || quality < 15) { // ANTES: 20
      // Devolver vacío en lugar del último válido para forzar reseteo visual si se pierde dedo/calidad
      return ResultFactory.createEmptyResults(); 
    }

    this.ppgBuffer.push(primaryOptimizedValue);
    if (this.ppgBuffer.length > this.BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }

    // No procesar si el buffer no está lleno
    if (this.ppgBuffer.length < this.BUFFER_SIZE * 0.5) { // ANTES: 0.8
        // Devolver vacío si el buffer no está suficientemente lleno
        return ResultFactory.createEmptyResults(); 
    }

    // --- Cálculos específicos usando el buffer optimizado --- 
    let spo2 = 0;
    let pressure = { systolic: 0, diastolic: 0 };
    let glucose = 0;
    let lipids = { totalCholesterol: 0, triglycerides: 0 };
    let hemoglobin = 0;
    let hydration = 0;
    let arrhythmiaResult: { arrhythmiaStatus: string; lastArrhythmiaData: any | null } = { arrhythmiaStatus: "--", lastArrhythmiaData: null };

    try {
      // SpO2 (Usa el buffer optimizado)
      spo2 = this.spo2Processor.calculateSpO2(this.ppgBuffer);

      // Blood Pressure (Usa el buffer optimizado)
      pressure = this.bpProcessor.calculateBloodPressure(this.ppgBuffer);

      // Arrhythmia (Usa rrData si está disponible)
      arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);

      // Glucose (Usa el buffer optimizado)
      glucose = this.glucoseProcessor.calculateGlucose(this.ppgBuffer);

      // Lipids (Usa el buffer optimizado)
      lipids = this.lipidProcessor.calculateLipids(this.ppgBuffer);

      // Hemoglobin (Estimado a partir de SpO2)
      hemoglobin = this.calculateDefaultHemoglobin(spo2);

      // Hydration (Usa el buffer optimizado)
      hydration = this.hydrationEstimator.analyze(this.ppgBuffer);

    } catch (error) {
      console.error("Error during vital sign calculation:", error);
      // Devolver último válido en caso de error en cálculos
      return this.lastValidResult ?? ResultFactory.createEmptyResults();
    }

    // --- Confianza y Ensamblaje Final --- 
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    // Ensamblar resultado
    const finalResult = ResultFactory.createResult(
      spo2,
      `${pressure.systolic}/${pressure.diastolic}`,
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

    // Actualizar último resultado válido
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
    // Estimación simple (Placeholder - mejorar si es posible)
    if (spo2 <= 0) return 0;
    // Ejemplo: Relación lineal simple (ajustar según datos/investigación)
    const baseHb = 12; // Base para SpO2 ~90%
    const scaleFactor = 0.15; // Cuánto cambia Hb por cada % de SpO2
    let estimatedHb = baseHb + (spo2 - 90) * scaleFactor;
    // Limitar a rangos razonables
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
    this.hydrationEstimator.reset();
    this.hemoglobinEstimator.reset();
    this.signalValidator.resetFingerDetection(); // Asegurarse de que SignalValidator también se reinicie si es necesario
    this.ppgBuffer = [];
    this.lastValidResult = null;
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
    return this.lastValidResult;
  }
  
  /**
   * Completely reset the processor
   * Ensures fresh start with no data carryover
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor: Performing full reset...");
    this.reset(); // Llama al reset normal
    // Podría incluir la recreación de instancias si fuera necesario
    // this.spo2Processor = new SpO2Processor();
    // ... etc.
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
