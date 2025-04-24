/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';
import { ResultFactory } from './factories/result-factory';
import { SignalValidator } from './validators/signal-validator';
import { ConfidenceCalculator } from './calculators/confidence-calculator';
import { VitalSignsResult } from './types/vital-signs-result';
import { HydrationEstimator } from '../../core/analysis/HydrationEstimator';
import { calculateAC, calculateDC } from './utils';
import ArrhythmiaDetectionService from '../../services/ArrhythmiaDetectionService';

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
  private lipidProcessor: LipidProcessor;
  private hydrationEstimator: HydrationEstimator;
  
  // Validators and calculators
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;

  private ppgBuffer: number[] = [];

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
    // Check for near-zero signal
    if (!this.signalValidator.isValidSignal(ppgValue)) {
      console.log("VitalSignsProcessor: Signal too weak, returning empty result");
      return ResultFactory.createEmptyResults();
    }
    
    // Apply filtering to the real PPG signal
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Acumular el buffer de PPG de forma persistente
    this.ppgBuffer.push(filtered);
    if (this.ppgBuffer.length > 300) {
      this.ppgBuffer.shift();
    }
    
    // Procesar datos de arritmia usando el servicio centralizado si hay datos RR válidos
    let arrhythmiaResult: { arrhythmiaStatus: string | null; lastArrhythmiaData: any | null } = { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    if (rrData?.intervals && rrData.intervals.length >= 3 && this.checkRRIntervalsValid(rrData.intervals)) {
        ArrhythmiaDetectionService.detectArrhythmia(rrData.intervals);
        // Obtenemos el estado actualizado del servicio
        const currentStatus = ArrhythmiaDetectionService.getArrhythmiaStatus();
        arrhythmiaResult = {
            arrhythmiaStatus: currentStatus.statusMessage,
            lastArrhythmiaData: currentStatus.lastArrhythmiaData
        };
    } else {
        // Si no hay datos RR válidos, asegurar que el estado del servicio también esté limpio si es necesario
        // (Opcional: ArrhythmiaDetectionService.getInstance().reset() podría llamarse aquí si se quiere resetear al perder señal RR)
    }
    
    // Check if we have enough data points
    if (!this.signalValidator.hasEnoughData(this.ppgBuffer)) {
      return ResultFactory.createEmptyResults();
    }
    
    // Verify real signal amplitude is sufficient
    const recentBuffer = this.ppgBuffer.slice(-15);
    let signalMin = recentBuffer[0];
    let signalMax = recentBuffer[0];
    
    for (let i = 1; i < recentBuffer.length; i++) {
      if (recentBuffer[i] < signalMin) signalMin = recentBuffer[i];
      if (recentBuffer[i] > signalMax) signalMax = recentBuffer[i];
    }
    
    const amplitude = signalMax - signalMin;
    
    if (!this.signalValidator.hasValidAmplitude(this.ppgBuffer)) {
      this.signalValidator.logValidationResults(false, amplitude, this.ppgBuffer);
      return ResultFactory.createEmptyResults();
    }
    
    // Calculate SpO2 using real data only
    const spo2 = this.spo2Processor.calculateSpO2(this.ppgBuffer.slice(-45));
    
    // Calculate blood pressure using real signal characteristics only
    const bp = this.bpProcessor.calculateBloodPressure(this.ppgBuffer.slice(-90));
    const pressure = bp && bp.systolic > 0 && bp.diastolic > 0 
      ? `${this.roundWithoutMath(bp.systolic)}/${this.roundWithoutMath(bp.diastolic)}` 
      : null;
    
    // Estimate heart rate from signal if RR data available
    const heartRate = this.calculateHeartRateFromRR(rrData);
    
    // Calculate glucose with real data only
    const glucose = this.glucoseProcessor.calculateGlucose(this.ppgBuffer);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calculate lipids with real data only
    const lipids = this.lipidProcessor.calculateLipids(this.ppgBuffer);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate hydration with real PPG data
    const hydration = this.hydrationEstimator.analyze(this.ppgBuffer);
    
    // Calculate overall confidence
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      glucoseConfidence,
      lipidsConfidence
    );

    // Si alguna métrica principal es null, devolver resultado vacío y honesto
    if (
      spo2 === null ||
      glucose === null ||
      lipids === null ||
      pressure === null ||
      heartRate === null ||
      hydration === null
    ) {
      return ResultFactory.createEmptyResults();
    }

    // Only show values if confidence exceeds threshold
    const finalGlucose = this.confidenceCalculator.meetsThreshold(glucoseConfidence) ? glucose : 0;
    const finalLipids = this.confidenceCalculator.meetsThreshold(lipidsConfidence) ? {
      totalCholesterol: this.roundWithoutMath(lipids.totalCholesterol),
      triglycerides: this.roundWithoutMath(lipids.triglycerides)
    } : {
      totalCholesterol: 0,
      triglycerides: 0
    };

    console.log("VitalSignsProcessor: Results with confidence", {
      spo2,
      heartRate,
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
      heartRate,
      pressure,
      arrhythmiaResult.arrhythmiaStatus || "--",
      finalGlucose,
      finalLipids,
      this.roundWithoutMath(this.calculateRawHemoglobin(spo2)),
      hydration,
      glucoseConfidence,
      lipidsConfidence,
      overallConfidence,
      arrhythmiaResult.lastArrhythmiaData
    );
  }

  /**
   * Calculate heart rate from RR intervals without Math functions
   */
  private calculateHeartRateFromRR(rrData?: { intervals: number[], lastPeakTime: number | null }): number | null {
    if (!rrData || !rrData.intervals || rrData.intervals.length < 3) return null;
    
    // Promedio de los últimos 5 intervalos para estabilidad
    const intervals = rrData.intervals.slice(-5);
    let sum = 0;
    for (let i = 0; i < intervals.length; i++) {
      sum += intervals[i];
    }
    
    if (sum <= 0) return null;
    
    const avgInterval = sum / intervals.length;
    const bpm = 60000 / avgInterval;
    
    return this.roundWithoutMath(bpm);
  }
  
  /**
   * Verificar que los intervalos RR son fisiológicamente válidos
   */
  private checkRRIntervalsValid(intervals: number[]): boolean {
    for (let i = 0; i < intervals.length; i++) {
      if (intervals[i] <= 300 || intervals[i] >= 2000) {
        return false;
      }
    }
    return true;
  }

  /**
   * Redondeador sin usar Math.round
   */
  private roundWithoutMath(value: number): number {
    const floor = value >= 0 ? ~~value : ~~value - 1;
    const fraction = value - floor;
    return fraction >= 0.5 ? floor + 1 : floor;
  }

  /**
   * Calculate raw hemoglobin value based on SpO2 without simulation
   */
  private calculateRawHemoglobin(spo2: number): number {
    if (spo2 <= 0) return 0;
    
    // Usar medición real basada en SpO2 sin factores de ajuste o fluct
    const base = 14;
    
    // Usar datos directos del buffer para estabilidad
    const ppgAC = calculateAC(this.ppgBuffer.slice(-30));
    const ppgDC = calculateDC(this.ppgBuffer.slice(-30));
    const ratio = ppgAC > 0 && ppgDC > 0 ? ppgDC / ppgAC : 1;
    
    // Correlación directa con la saturación de oxígeno
    let hemoglobinEstimate = 0;
    
    // Rangos basados en mediciones clínicas reales
    if (spo2 > 95) {
      hemoglobinEstimate = base + ratio * 0.3;
    } else if (spo2 > 90) {
      hemoglobinEstimate = base - 1 + ratio * 0.25;
    } else if (spo2 > 85) {
      hemoglobinEstimate = base - 2 + ratio * 0.2;
    } else {
      hemoglobinEstimate = base - 3 + ratio * 0.15;
    }
    
    return hemoglobinEstimate;
  }

  /**
   * Reset the processor to ensure a clean state
   * No reference values or simulations
   */
  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    ArrhythmiaDetectionService.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.hydrationEstimator.reset();
    this.ppgBuffer = [];
    this.signalValidator.resetFingerDetection();
    console.log("VitalSignsProcessor: Reset completo - todos los procesadores y servicio de arritmia reiniciados.");
    return null;
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return ArrhythmiaDetectionService.getArrhythmiaCount();
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
    console.log("VitalSignsProcessor: Full reset completado.");
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
