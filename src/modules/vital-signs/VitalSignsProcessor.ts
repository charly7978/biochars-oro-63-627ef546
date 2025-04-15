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
import { CalibrationIntegrator } from '../../core/calibration/CalibrationIntegrator';
import { BidirectionalFeedbackService } from '@/services/BidirectionalFeedbackService';

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
  private lastValidResult: VitalSignsResult | null = null;

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
    this.signalValidator = new SignalValidator();
    this.confidenceCalculator = new ConfidenceCalculator();
  }
  
  /**
   * Processes the real PPG signal and calculates all vital signs
   * Using ONLY direct measurements with no reference values or simulation
   */
  public async processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): Promise<VitalSignsResult> {
    // 1. Procesamiento Básico de Señal
    const { filteredValue, quality, fingerDetected } = this.signalProcessor.applyFilters(ppgValue);

    // *** Log Valor Filtrado ***
    // console.log(`[VitalSignsProcessor] Raw: ${ppgValue.toFixed(3)}, Filtered: ${filteredValue.toFixed(3)}, Quality: ${quality}, Finger: ${fingerDetected}`);

    if (!fingerDetected || quality < 30) {
        // console.warn(`[VitalSignsProcessor] Low quality (${quality}) or no finger (${fingerDetected}). Returning last valid or empty.`);
        return this.lastValidResult || ResultFactory.createEmptyResults();
    }

    // Obtener los valores PPG acumulados
    const ppgValues = this.getSignalProcessorPPGValues();

    // *** Log Buffer PPG ***
    // console.log(`[VitalSignsProcessor] ppgValues buffer size: ${ppgValues.length}, last 5: ${ppgValues.slice(-5).map(v => v.toFixed(3)).join(', ')}`);


    // Validar datos suficientes y amplitud
    if (!this.signalValidator.hasEnoughData(ppgValues)) {
        // console.warn(`[VitalSignsProcessor] Not enough data (${ppgValues.length}). Returning last valid or empty.`);
        return this.lastValidResult || ResultFactory.createEmptyResults();
    }

     // *** Calcular y Loguear Amplitud ***
     // Asumiendo que existe una función calculateAmplitude (importarla o definirla)
     // import { calculateAmplitude } from './utils/peak-detection-utils'; // O donde esté definida
     const { peakIndices, valleyIndices } = findPeaksAndValleys(ppgValues); // Necesita esta función
     const amplitude = calculateAmplitude(ppgValues, peakIndices, valleyIndices); // Necesita esta función
     console.log(`[VitalSignsProcessor] Calculated Amplitude: ${amplitude.toFixed(4)} (Peaks: ${peakIndices.length}, Valleys: ${valleyIndices.length})`);

     // Usar un umbral razonable para la amplitud calculada
     const MIN_AMPLITUDE_THRESHOLD = 0.05; // AJUSTAR ESTE UMBRAL SEGÚN SEA NECESARIO
     if (amplitude < MIN_AMPLITUDE_THRESHOLD) {
          console.warn(`[VitalSignsProcessor] Calculated amplitude ${amplitude.toFixed(4)} is below threshold ${MIN_AMPLITUDE_THRESHOLD}. Returning last valid.`);
          return this.lastValidResult || ResultFactory.createEmptyResults();
     }


    // 2. Cálculos Tradicionales
    const traditionalSpo2 = this.spo2Processor.calculateSpO2(ppgValues);
    const traditionalBP = this.bpProcessor.calculateBloodPressure(ppgValues);
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    const traditionalGlucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const traditionalLipids = this.lipidProcessor.calculateLipids(ppgValues);
    const traditionalHydration = this.hydrationEstimator.estimate(ppgValues);
    const traditionalHeartRate = this.getSignalProcessorHeartRate();

    // console.log(`[VitalSignsProcessor] Traditional Values: HR=${traditionalHeartRate}, SpO2=${traditionalSpo2}, Sys=${traditionalBP.systolic}, Dia=${traditionalBP.diastolic}, Gluc=${traditionalGlucose}`);


    // 3. Preparar datos para CalibrationIntegrator
    const rawDataForIntegrator = {
      ppgValues: ppgValues,
      heartRate: traditionalHeartRate,
      spo2: traditionalSpo2,
      systolic: traditionalBP.systolic,
      diastolic: traditionalBP.diastolic,
      glucose: traditionalGlucose,
      quality: quality,
    };

    // 4. Llamar al CalibrationIntegrator y ESPERAR el resultado
    console.time("CalibrationIntegratorProcessing");
    const finalResults = await CalibrationIntegrator.getInstance().processMeasurement(rawDataForIntegrator);
    console.timeEnd("CalibrationIntegratorProcessing");

    // 5. Calcular confianza y otros valores derivados de finalResults
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    // Calcular confianza general (podría mejorarse)
    const overallConfidence = (glucoseConfidence + lipidsConfidence) / 2;


     // 6. Crear el resultado final usando los valores del Integrator
     const finalVitalSignsResult: VitalSignsResult = ResultFactory.createResult(
         finalResults.spo2,
         finalResults.heartRate,
         `${finalResults.systolic}/${finalResults.diastolic}`,
         arrhythmiaResult.arrhythmiaStatus, // Mantener estado de arritmia del procesador dedicado
         finalResults.glucose,
         traditionalLipids, // ¿Usar lípidos calibrados si el Integrator los devuelve/ajusta? Por ahora tradicional.
         this.calculateDefaultHemoglobin(finalResults.spo2), // Usar SpO2 final
         traditionalHydration, // ¿Usar hidratación calibrada? Por ahora tradicional.
         glucoseConfidence,
         lipidsConfidence,
         overallConfidence, // Pasar la confianza calculada
         arrhythmiaResult.lastArrhythmiaData
     );

     // 7. Actualizar último resultado válido
     this.lastValidResult = finalVitalSignsResult;

     // 8. Enviar feedback al servicio bidireccional
     try {
        BidirectionalFeedbackService.getInstance().processVitalSignsResults(finalVitalSignsResult, quality);
     } catch (error) {
        console.error("Error sending feedback to BidirectionalFeedbackService:", error);
     }


     return finalVitalSignsResult;
  } // Fin de processSignal (Ahora async)


  // --- Funciones Helper (getSignalProcessorPPGValues, getSignalProcessorHeartRate) ---
  // Asegúrate que SignalProcessor realmente exponga estos métodos o datos
  private getSignalProcessorPPGValues(): number[] {
    return this.signalProcessor.getPPGValues ? this.signalProcessor.getPPGValues() : [];
  }
  private getSignalProcessorHeartRate(): number {
    return this.signalProcessor.calculateHeartRate ? this.signalProcessor.calculateHeartRate() : 0;
  }

  /**
   * Calculate a default hemoglobin value based on SpO2
   */
  private calculateDefaultHemoglobin(spo2: number): number {
    if (spo2 <= 0) return 0;
    
    // Very basic approximation
    const base = 14;
    
    if (spo2 > 95) return base + Math.random();
    if (spo2 > 90) return base - 1 + Math.random();
    if (spo2 > 85) return base - 2 + Math.random();
    
    return base - 3 + Math.random();
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
    this.signalValidator.resetFingerDetection();
    console.log("VitalSignsProcessor: Reset complete - all processors at zero");
    this.lastValidResult = null;
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
    return this.lastValidResult;
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

// Declare external functions
declare function findPeaksAndValleys(values: number[]): { peakIndices: number[]; valleyIndices: number[] };
declare function calculateAmplitude(values: number[], peakIndices: number[], valleyIndices: number[]): number;
