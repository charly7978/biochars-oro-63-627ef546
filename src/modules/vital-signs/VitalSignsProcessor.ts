/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { ResultFactory } from './factories/result-factory';
import { ConfidenceCalculator } from './calculators/confidence-calculator';
import { VitalSignsResult } from './types/vital-signs-result';
import { RRIntervalData } from './arrhythmia/types';
import ArrhythmiaDetectionService from '@/services/ArrhythmiaDetectionService';
import { calculateAC, evaluateSignalQuality } from './shared-signal-utils';

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
    console.log("VitalSignsProcessor: Initializing (No Neural Models)");
    
    // Initialize specialized processors
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    
    // Initialize calculators
    this.confidenceCalculator = new ConfidenceCalculator();

    this.reset();
  }
  
  /**
   * Processes PPG signal to estimate SpO2, BP, and Glucose.
   * Heart Rate and Arrhythmia are handled externally.
   */
  public processSignal(
    filteredPpgValue: number 
  ): Omit<VitalSignsResult, 'heartRate' | 'arrhythmiaStatus' | 'lastArrhythmiaData' | 'hydration' | 'lipids' | 'hemoglobin'> {
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
        console.log("VitalSignsProcessor: Signal stabilized @ frame", this.processedFrameCount);
      }
    }
    
    // Log specific for debugging data flow
    if (this.processedFrameCount % 30 === 0 || this.processedFrameCount < 10) {
      console.log("VitalSignsProcessor: Processing frame", {
        frameCount: this.processedFrameCount,
        filteredPpgValue,
        isStabilized: this.isStabilized
      });
    }
    
    // Procesamiento directo usando los valores reales
    let spo2: number | typeof NaN = NaN;
    let pressureSystolic: number | typeof NaN = NaN;
    let pressureDiastolic: number | typeof NaN = NaN;
    let glucose: number | typeof NaN = NaN;
    let glucoseConfidence = 0;
    let overallConfidence = 0;
    
    // Usar el SignalProcessor interno para obtener el historial del *valor filtrado*
    // NOTA: Esto podría ser redundante si HeartRateService ya mantiene un buffer similar.
    // Considerar pasar ppgHistory como argumento si es más eficiente.
    this.signalProcessor.processPPG(filteredPpgValue); // Añadir valor filtrado actual al buffer interno
    const ppgHistory = this.signalProcessor.getPPGValues(); 

    const hasEnoughData = ppgHistory.length >= 15; 
    const amplitude = hasEnoughData ? calculateAC(ppgHistory.slice(-30)) : 0; 
    const isValidAmplitude = amplitude > 0.01; 
    // Calcular calidad basada en el historial de valores filtrados
    const signalQuality = evaluateSignalQuality(ppgHistory); 

    // Solo calculamos mediciones si tenemos suficientes datos y señal estable
    if (hasEnoughData && isValidAmplitude && this.isStabilized && signalQuality > 30) {
      
      // Estimar SpO2 usando modelo NN
      spo2 = this.spo2Processor.calculateSpO2(ppgHistory);
      
      // Estimar Presión Arterial usando modelo NN
      const bpResult = this.bpProcessor.calculateBloodPressure(ppgHistory);
      pressureSystolic = bpResult.systolic;
      pressureDiastolic = bpResult.diastolic;
      
      // Calcular glucosa con procesamiento directo
      glucose = this.glucoseProcessor.calculateGlucose(ppgHistory);
      
      glucoseConfidence = this.glucoseProcessor.getConfidence();
      const bpConfidence = this.bpProcessor.getConfidence(); 
      const spo2Confidence = this.spo2Processor.getConfidence();
      const confidences = [glucoseConfidence, bpConfidence, spo2Confidence].filter(c => !isNaN(c) && c > 0);
      overallConfidence = confidences.length > 0 ? confidences.reduce((s, c) => s + c, 0) / confidences.length : 0;

    } else if (this.processedFrameCount % 50 === 0) {
        // Log if not calculating
         console.log("VitalSignsProcessor: Insufficient data/quality for calculation", {
            hasEnoughData, amplitude, isStabilized: this.isStabilized, signalQuality
        });
    }
    
    // Format pressure string
    const pressureString = !isNaN(pressureSystolic) && !isNaN(pressureDiastolic)
                           ? `${Math.round(pressureSystolic)}/${Math.round(pressureDiastolic)}`
                           : "--/--";

    // Return only the relevant calculated values + confidence
    const partialResult = {
        spo2: isNaN(spo2) ? NaN : Math.round(spo2), // Devolver NaN si no se calculó
        pressure: pressureString,
        glucose: isNaN(glucose) ? NaN : Math.round(glucose), // Devolver NaN si no se calculó
        glucoseConfidence,
        overallConfidence, 
    };

    // Update last valid result logic needs adjustment if needed
    // This logic might need rethinking as it doesn't include HR/Arrhythmia anymore
    /*
    if (
      partialResult.spo2 > 0 ||
      partialResult.glucose > 0 ||
      partialResult.pressure !== "--/--"
    ) {
      // How to combine this partial result with HR/Arrhythmia from external sources?
      // this.lastValidResult = { ...result }; // Need to merge with HR/Arrhythmia state
    }
    */
    
    return partialResult;
  }
  
  /**
   * Get the last valid result if available
   */
  public getLastValidResult(): Partial<VitalSignsResult> | null {
    // Adaptar si es necesario, ahora solo contiene SpO2, BP, Glucosa
    return this.lastValidResult ? { 
        spo2: this.lastValidResult.spo2, 
        pressure: this.lastValidResult.pressure, 
        glucose: this.lastValidResult.glucose,
        glucoseConfidence: this.lastValidResult.glucoseConfidence,
        overallConfidence: this.lastValidResult.overallConfidence
     } : null;
  }
  
  /**
   * Reset all processors
   */
  public reset(): void {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    // Reset internal state
    this.lastValidResult = null;
    this.isStabilized = false;
    this.stabilizationCounter = 0;
    console.log("VitalSignsProcessor: Reset processors");
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
