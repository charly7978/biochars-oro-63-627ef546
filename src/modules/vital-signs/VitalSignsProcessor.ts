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
import { calculateAC, evaluateSignalQuality, normalizeValues, findPeaksAndValleys, calculateDC, calculateStandardDeviation } from './shared-signal-utils';

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
    console.log("VitalSignsProcessor: Initializing (No Neural Models)");
    
    // Initialize specialized processors
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    
    // Initialize validators and calculators
    this.signalValidator = new SignalValidator();
    this.confidenceCalculator = new ConfidenceCalculator();

    this.reset();
  }
  
  /**
   * Processes PPG signal to estimate SpO2, BP, and Glucose.
   * Heart Rate and Arrhythmia are now handled externally.
   */
  public processSignal(
    ppgValue: number 
  ): Omit<VitalSignsResult, 'heartRate' | 'arrhythmiaStatus' | 'lastArrhythmiaData'> {
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
        isStabilized: this.isStabilized
      });
    }

    const filteredValue = this.signalProcessor.processPPG(ppgValue);
    const ppgHistory = this.signalProcessor.getPPGValues();

    const hasEnoughData = ppgHistory.length >= 15; 
    const amplitude = hasEnoughData ? calculateAC(ppgHistory.slice(-30)) : 0; 
    const isValidAmplitude = amplitude > 0.01; 
    const signalQuality = evaluateSignalQuality(ppgHistory);

    // Initialize results as NaN
    let spo2: number | typeof NaN = NaN;
    let pressureSystolic: number | typeof NaN = NaN;
    let pressureDiastolic: number | typeof NaN = NaN;
    let glucose: number | typeof NaN = NaN;
    let glucoseConfidence = 0;
    let overallConfidence = 0;

    // Calculate only if signal is usable
    if (hasEnoughData && isValidAmplitude && this.isStabilized && signalQuality > 30) { 
      spo2 = this.spo2Processor.calculateSpO2(ppgHistory);
      const bpResult = this.bpProcessor.calculateBloodPressure(ppgHistory);
      pressureSystolic = bpResult.systolic;
      pressureDiastolic = bpResult.diastolic;
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
        spo2: isNaN(spo2) ? 0 : Math.round(spo2), // Convert NaN for now, UI should handle NaN display
        pressure: pressureString,
        glucose: isNaN(glucose) ? 0 : Math.round(glucose), // Convert NaN for now
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
    // Reset internal state
    this.signalBufferRed = []; // Keep if signalProcessor uses them
    this.signalBufferIR = []; // Keep if signalProcessor uses them
    this.timestamps = []; // Keep if signalProcessor uses them
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
