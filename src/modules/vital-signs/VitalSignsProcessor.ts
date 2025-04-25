
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
  // Umbral para estabilización
  private readonly STABILIZATION_THRESHOLD: number = 15;

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
    
    // Procesamiento directo usando los valores reales
    let heartRate = 0;
    let spo2 = 0;
    let pressure = "--/--";
    let glucose = 0;
    let hemoglobin = 0;
    let hydration = 0;
    let lipids = { totalCholesterol: 0, triglycerides: 0 };
    
    // Solo calculamos mediciones si tenemos suficientes datos
    if (hasEnoughData && amplitude > 0.01) {
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
      if (rrData && rrData.intervals && rrData.intervals.length > 3) {
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
      
      // Calcular hemoglobina - valor provisional pendiente de implementación directa
      hemoglobin = 0; // Por ahora no hay implementación real, reportar ausencia
      
      // Calcular hidratación con medición directa
      hydration = this.hydrationEstimator.analyze(ppgValues);
    } else {
      // Si no hay suficientes datos, reportar ausencia de mediciones
      console.log("VitalSignsProcessor: Datos insuficientes para medición", {
        dataPoints: ppgValues.length,
        amplitude: amplitude,
        minRequired: 15
      });
    }
    
    // Log all vital signs for diagnostic purposes 
    if (this.processedFrameCount % 15 === 0 || this.processedFrameCount < 5) {
      console.log("VitalSignsProcessor: Real measurements calculated", {
        spo2,
        heartRate,
        pressure,
        arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
        glucose,
        lipids,
        hemoglobin,
        hydration,
        frameCount: this.processedFrameCount,
        signalAmplitude: amplitude,
        isStabilized: this.isStabilized
      });
    }
    
    // Calcular confidence de las mediciones
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Determinar confiabilidad general basada en la calidad de señal real
    let overallConfidence = 0;
    if (amplitude > 0.02) {
      overallConfidence = 0.7;
    } else if (amplitude > 0.01) {
      overallConfidence = 0.3;
    } else {
      overallConfidence = 0; // Sin confianza si la señal es muy débil
    }

    // Prepare result with all metrics
    const result = ResultFactory.createResult(
      spo2,
      heartRate,
      pressure,
      arrhythmiaResult.arrhythmiaStatus || "--",
      glucose,
      lipids,
      hemoglobin,
      hydration,
      glucoseConfidence, 
      lipidsConfidence,
      overallConfidence,
      arrhythmiaResult.lastArrhythmiaData
    );
    
    // Guardar como último resultado válido solo si hay datos interesantes
    if (spo2 > 0 || heartRate > 0 || glucose > 0 || hydration > 0 || 
        lipids.totalCholesterol > 0 || lipids.triglycerides > 0) {
      this.lastValidResult = result;
    }
    
    // Always return the current result
    return result;
  }

  /**
   * Get the last valid results if available, otherwise empty results
   */
  public getLastValidResults(): VitalSignsResult | null {
    if (this.lastValidResult) {
      console.log("VitalSignsProcessor: Returning last valid result", this.lastValidResult);
      return this.lastValidResult;
    }
    console.log("VitalSignsProcessor: No valid result available, returning null");
    return null;
  }

  /**
   * Reset the processor to ensure a clean state
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
