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
import { HemoglobinEstimator } from '../../core/analysis/HemoglobinEstimator';

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
  private hemoglobinEstimator: HemoglobinEstimator;
  
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
  // Umbral para estabilización - REDUCIDO para obtener datos más rápido
  private readonly STABILIZATION_THRESHOLD: number = 10;

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
    this.hemoglobinEstimator = new HemoglobinEstimator();
    
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
    const filtered = this.signalProcessor.processPPG(ppgValue);
    
    // Process arrhythmia data if available and valid
    const arrhythmiaResult = rrData && 
                           rrData.intervals && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    // Get PPG values for processing
    const ppgValues = this.signalProcessor.getPPGValues();
    
    // Continue processing regardless of data quantity - MODIFICADO para ser más permisivo
    let hasEnoughData = ppgValues.length >= 10; // Reducido de 15 a 10 para obtener datos más rápido
    
    // Verificar amplitud - solo log, no retornamos
    let signalMin = ppgValues.length > 0 ? ppgValues[0] : 0;
    let signalMax = ppgValues.length > 0 ? ppgValues[0] : 0;
    
    for (let i = 1; i < ppgValues.length && i < 15; i++) {
      if (ppgValues[i] < signalMin) signalMin = ppgValues[i];
      if (ppgValues[i] > signalMax) signalMax = ppgValues[i];
    }
    
    const amplitude = signalMax - signalMin;
    
    // Logging para debug
    if (this.processedFrameCount % 50 === 0) {
      console.log("VitalSignsProcessor: Signal analysis", {
        amplitude,
        signalMin,
        signalMax,
        ppgValuesLength: ppgValues.length,
        hasEnoughData,
        isStabilized: this.isStabilized
      });
    }
    
    // Procesamiento directo usando los valores reales
    let heartRate = 0;
    let spo2 = 0;
    let pressure = "--/--";
    let glucose = 0;
    let hemoglobin = 0;
    let hydration = 0;
    let lipids = { totalCholesterol: 0, triglycerides: 0 };
    
    // Solo calculamos mediciones si tenemos suficientes datos - MODIFICADO: umbral más permisivo
    if (hasEnoughData && amplitude > 0.005) { // Reducido de 0.01 a 0.005
      // Calcular SpO2 usando procesamiento directo
      spo2 = this.spo2Processor.calculateSpO2(ppgValues);
      
      // Calcular presión arterial con datos directos
      const bpResult = this.bpProcessor.calculateBloodPressure(ppgValues);
      
      // Solo asignar valores válidos, no valores por defecto
      if (bpResult.systolic > 0 && bpResult.diastolic > 0) {
        pressure = `${bpResult.systolic}/${bpResult.diastolic}`;
      } else {
        pressure = "--/--"; // Indicar que no hay medición válida
      }
      
      // Calcular frecuencia cardíaca directa
      if (rrData && rrData.intervals && rrData.intervals.length >= 2) { // Reducido a 2 para ser más permisivo
        let sum = 0;
        const lastFiveIntervals = rrData.intervals.slice(-5);
        for (let i = 0; i < lastFiveIntervals.length; i++) {
          sum += lastFiveIntervals[i];
        }
        const avgInterval = sum / lastFiveIntervals.length;
        if (avgInterval > 0) {
          heartRate = Math.round(60000 / avgInterval);
          // Validar rango realista
          if (heartRate < 40 || heartRate > 200) {
            heartRate = 0; // Indicar medición no válida
          }
        }
      }
      
      // Calcular glucosa con procesamiento directo
      glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
      
      // Calcular perfil lipídico con datos directos
      lipids = this.lipidProcessor.calculateLipids(ppgValues);
      
      // Calcular hemoglobina con medición directa
      hemoglobin = this.hemoglobinEstimator.estimateHemoglobin(ppgValues);
      
      // Calcular hidratación con medición directa
      hydration = this.hydrationEstimator.analyze(ppgValues);
      
      // Log detallado cada cierto número de frames
      if (this.processedFrameCount % 50 === 0) {
        console.log("VitalSignsProcessor: Calculated values", {
          heartRate,
          spo2,
          pressure,
          glucose,
          hemoglobin,
          hydration,
          lipids
        });
      }
    } else if (this.processedFrameCount % 50 === 0) {
      console.log("VitalSignsProcessor: Insufficient data for calculation", {
        hasEnoughData,
        amplitude,
        ppgValuesLength: ppgValues.length
      });
    }
    
    // Create result object with all measurements
    const result: VitalSignsResult = {
      heartRate,
      spo2,
      pressure,
      glucose,
      hydration,
      lipids,
      hemoglobin,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData
    };
    
    // Si tenemos al menos un valor válido, guardar como último válido
    if (
      result.heartRate > 0 ||
      result.spo2 > 0 ||
      result.glucose > 0 ||
      result.hemoglobin > 0 ||
      result.hydration > 0 ||
      (result.lipids && (result.lipids.totalCholesterol > 0 || result.lipids.triglycerides > 0)) ||
      (result.pressure && result.pressure !== "--/--")
    ) {
      this.lastValidResult = { ...result };
      
      // Log cuando guardamos un nuevo resultado válido
      if (this.processedFrameCount % 50 === 0) {
        console.log("VitalSignsProcessor: Valid result saved", result);
      }
    } else if (this.processedFrameCount % 50 === 0) {
      console.log("VitalSignsProcessor: No valid values to save", result);
    }
    
    return result;
  }
  
  /**
   * Get the last valid result if available
   */
  public getLastValidResult(): VitalSignsResult | null {
    return this.lastValidResult;
  }
  
  /**
   * Get arrhythmia counter from processor
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount();
  }
  
  /**
   * Reset all processors
   */
  public reset(): void {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.hydrationEstimator.reset();
    this.hemoglobinEstimator.reset();
    this.lastValidResult = null;
    this.isStabilized = false;
    this.stabilizationCounter = 0;
    console.log("VitalSignsProcessor: All processors reset");
  }
  
  /**
   * Full reset of all processors and internal state
   */
  public fullReset(): void {
    this.reset();
    this.processedFrameCount = 0;
    console.log("VitalSignsProcessor: Full reset completed");
  }
}
