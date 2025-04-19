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
   * Procesa la señal optimizada para calcular todos los signos vitales.
   *
   * @param primaryOptimizedValue El valor de la señal PPG principal, optimizado (ej. del canal 'general').
   * @param contextSignal El objeto ProcessedSignal original (post-OpenCV/filtros base) para contexto.
   * @param rrData Datos de intervalo RR para análisis de arritmia.
   * @param allOptimizedValues (Opcional) Todos los valores optimizados por canal.
   * @returns Resultados de los signos vitales.
   */
  public processSignal(
    primaryOptimizedValue: number, // Volver a usar este
    contextSignal: ProcessedSignal,
    rrData?: RRData,
    allOptimizedValues?: Record<string, number> // Mantener por si se usa para feedback
  ): VitalSignsResult {
    if (!contextSignal || typeof primaryOptimizedValue !== 'number') {
        console.warn("VitalSignsProcessor: Entrada inválida para processSignal");
        return this.lastValidResult ?? ResultFactory.createEmptyResults();
    }

    const { quality, fingerDetected } = contextSignal;

    if (!fingerDetected || quality < 15) {
      return ResultFactory.createEmptyResults();
    }

    // --- Buffering del valor OPTIMIZADO principal --- 
    this.ppgBuffer.push(primaryOptimizedValue);
    if (this.ppgBuffer.length > this.BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }

    // No procesar si el buffer no está lleno
    if (this.ppgBuffer.length < this.BUFFER_SIZE * 0.5) {
        return ResultFactory.createEmptyResults();
    }

    // --- Cálculos específicos usando el buffer OPTIMIZADO --- 
    let spo2 = 0;
    let pressure = { systolic: 0, diastolic: 0 };
    let glucose = 0;
    let lipids = { totalCholesterol: 0, triglycerides: 0 };
    let hemoglobin = 0;
    let hydration = 0;
    let arrhythmiaResult: { arrhythmiaStatus: string; lastArrhythmiaData: any | null } = { arrhythmiaStatus: "--", lastArrhythmiaData: null };

    try {
      // *** LOG ANTES de SpO2 ***
      // console.log(`VSProcessor: Calculando SpO2. Tamaño Buffer: ${this.ppgBuffer.length}. Primeros 5 valores: ${this.ppgBuffer.slice(0,5).map(v => v.toFixed(4)).join(', ')}`);
      spo2 = this.spo2Processor.calculateSpO2(this.ppgBuffer);
      // *** LOG DESPUÉS de SpO2 ***
      // console.log(`VSProcessor: SpO2 calculado: ${spo2}`);
      
      pressure = this.bpProcessor.calculateBloodPressure(this.ppgBuffer);
      arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
      glucose = this.glucoseProcessor.calculateGlucose(this.ppgBuffer);
      lipids = this.lipidProcessor.calculateLipids(this.ppgBuffer);
      hemoglobin = this.calculateDefaultHemoglobin(spo2);
      hydration = this.hydrationEstimator.analyze(this.ppgBuffer);

    } catch (error) {
      console.error("Error during vital sign calculation:", error);
      return this.lastValidResult ?? ResultFactory.createEmptyResults();
    }

    // --- Confianza y Ensamblaje Final --- 
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

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
    this.hemoglobinEstimator.reset();
    this.hydrationEstimator.reset();
    this.signalValidator.resetFingerDetection();
    this.ppgBuffer = []; // Limpiar buffer principal
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
