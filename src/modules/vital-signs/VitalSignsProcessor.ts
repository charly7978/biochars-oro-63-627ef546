/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { ResultFactory } from './factories/result-factory';
import { SignalValidator } from './validators/signal-validator';
import { ConfidenceCalculator } from './calculators/confidence-calculator';
import { VitalSignsResult } from './types/vital-signs-result';
import { RRIntervalData } from './arrhythmia/types';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';

/**
 * Main vital signs processor
 * Integrates different specialized processors to calculate health metrics
 * Operates ONLY in direct measurement mode without reference values or simulation
 */
export class VitalSignsProcessor {
  // Specialized processors
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  
  // Validators and calculators
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;
  
  // Propiedades añadidas para corregir errores
  private signalBufferRed: number[] = [];
  private signalBufferIR: number[] = [];
  private timestamps: number[] = [];
  private perfusionIndex: number = 0;
  
  // Última medición válida
  private lastValidResult: VitalSignsResult | null = null;
  
  // Contador de señales y frames procesados
  private processedFrameCount: number = 0;
  
  // Flag to indicate if stabilization phase is complete
  private isStabilized: boolean = false;
  private stabilizationCounter: number = 0;
  // Umbral para estabilización - REDUCIDO para obtener datos más rápido
  private readonly STABILIZATION_THRESHOLD: number = 10;

  // Usar RRIntervalData
  private rrDataBuffer: RRIntervalData = { intervals: [], lastPeakTime: null };

  /**
   * Constructor that initializes all specialized processors
   * Using only direct measurement
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance with direct measurement only");
    
    // Initialize specialized processors
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    
    // Initialize validators and calculators
    this.signalValidator = new SignalValidator(0.01, 15);
    this.confidenceCalculator = new ConfidenceCalculator(0.15);

    this.reset();
  }
  
  /**
   * Processes the real PPG signal and calculates all vital signs
   * Using ONLY direct measurements with no reference values or simulation
   */
  public processSignal(
    ppgValue: number,
    rrData?: RRIntervalData
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
    
    // La detección de arritmia se hace externamente
    const arrhythmiaResult = { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
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
    let glucoseConfidence = 0; // Declarar fuera del if con valor por defecto
    let overallConfidence = 0; // Declarar fuera del if con valor por defecto
    
    // Solo calculamos mediciones si tenemos suficientes datos
    if (hasEnoughData && amplitude > 0.005) {
      // Calcular SpO2 (asume que devuelve número)
      spo2 = this.spo2Processor.calculateSpO2(ppgValues); 
      
      // Calcular presión arterial con datos directos
      const bpResult = this.bpProcessor.calculateBloodPressure(ppgValues);
      if (bpResult.systolic > 0 && bpResult.diastolic > 0) {
        pressure = `${bpResult.systolic}/${bpResult.diastolic}`;
      } else {
        pressure = "--/--"; 
      }
      
      // Calcular frecuencia cardíaca - Priorizar cálculo desde RR si hay datos
      if (rrData && rrData.intervals && rrData.intervals.length >= 2) { 
        let sum = 0;
        const lastFiveIntervals = rrData.intervals.slice(-5);
        for (let i = 0; i < lastFiveIntervals.length; i++) {
          sum += lastFiveIntervals[i];
        }
        const avgInterval = sum / lastFiveIntervals.length;
        if (avgInterval > 0) {
          const hrFromRR = Math.round(60000 / avgInterval);
          if (hrFromRR >= 40 && hrFromRR <= 200) {
            heartRate = hrFromRR; 
          }
        }
      } 
      // Si no se pudo calcular HR desde RR, quizás otro procesador la provea?
      // (Se necesita revisar cómo se obtiene HR si no hay RR válidos)
      // Por ahora, si no hay RR, heartRate permanecerá en 0 si no se calcula en otro lado.
      
      // Calcular glucosa con procesamiento directo
      glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
      
      // Calcular Confidence Scores
      glucoseConfidence = this.glucoseProcessor.getConfidence();
      const lipidsConfidencePlaceholder = 0; // Since lipids processor is removed
      overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
        glucoseConfidence, 
        lipidsConfidencePlaceholder
      );
      
      // Log detallado cada cierto número de frames
      if (this.processedFrameCount % 50 === 0) {
        console.log("VitalSignsProcessor: Calculated values", {
          heartRate,
          spo2,
          pressure,
          glucose,
        });
      }
    } else if (this.processedFrameCount % 50 === 0) {
      console.log("VitalSignsProcessor: Insufficient data for calculation", {
        hasEnoughData,
        amplitude,
        ppgValuesLength: ppgValues.length
      });
    }
    
    // Create result object using the factory - Ahora las variables de confianza siempre están definidas
    const result = ResultFactory.createResult(
      spo2,
      heartRate,
      pressure,
      arrhythmiaResult.arrhythmiaStatus,
      glucose,
      glucoseConfidence,
      overallConfidence,
      arrhythmiaResult.lastArrhythmiaData
    );
    
    // Si tenemos al menos un valor válido, guardar como último válido
    if (
      result.heartRate > 0 ||
      result.spo2 > 0 ||
      result.glucose > 0 ||
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
   * Reset all processors
   */
  public reset(): void {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();

    // Resetear propiedades añadidas
    this.signalBufferRed = [];
    this.signalBufferIR = [];
    this.timestamps = [];
    this.perfusionIndex = 0;
    this.rrDataBuffer = { intervals: [], lastPeakTime: null };

    // Resetear estado interno
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

  private calculateRRIntervals(peaks: { redIndex: number, irIndex: number }[], timestamps: number[]): RRIntervalData {
    const intervals: number[] = [];
    let lastPeakTime: number | null = null;

    // Usar picos IR ya que suelen ser más robustos para RR
    const irPeakTimes = peaks.map(p => timestamps[p.irIndex]).filter(t => t > 0);

    if (irPeakTimes.length > 1) {
        for (let i = 1; i < irPeakTimes.length; i++) {
            const interval = irPeakTimes[i] - irPeakTimes[i - 1];
            // Validar intervalo fisiológicamente (ej: 300ms a 2000ms)
            if (interval >= 300 && interval <= 2000) {
                intervals.push(interval);
            }
        }
        lastPeakTime = irPeakTimes[irPeakTimes.length - 1];
    }
    
    return { intervals, lastPeakTime };
  }

  /**
   * Get arrhythmia counter from the dedicated service
   */
  public getArrhythmiaCounter(): number {
    // Llama al servicio singleton directamente
    return ArrhythmiaDetectionService.getArrhythmiaCount(); 
  }

  /**
   * Get last calculated RR data
   */
  public getLastRRData(): RRIntervalData {
    return this.rrDataBuffer;
  }
}
