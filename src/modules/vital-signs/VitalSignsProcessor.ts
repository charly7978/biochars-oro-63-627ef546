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
import { VitalSignsResult, LipidsResult, ArrhythmiaProcessingResult, RRData } from '../../types/vital-signs';
import { HydrationEstimator } from '../../core/analysis/HydrationEstimator';
import { OPTIMIZED_TENSORFLOW_CONFIG } from '../../core/neural/tensorflow/TensorFlowConfig';
import * as tf from '@tensorflow/tfjs';
import { ProcessedSignal } from '../../types/signal';
import { HydrationProcessor } from './hydration-processor';

interface ProcessedSignalData {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: any;
  hydration: number;
  lastArrhythmiaData: any;
}

/**
 * Procesador principal de signos vitales optimizado para máxima precisión
 */
export class VitalSignsProcessor {
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  private hydrationEstimator: HydrationEstimator;
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;
  private signalBuffer: Float32Array;
  private readonly BUFFER_SIZE = 300;
  private readonly MIN_SAMPLES_FOR_ANALYSIS = 200;
  private processingWorker: Worker | null = null;
  private lastValidResults: VitalSignsResult | null = null;
  private arrhythmiaCounter: number = 0;
  private ppgBuffer: number[] = [];
  private bloodPressureProcessor: BloodPressureProcessor;
  private hydrationProcessor: HydrationProcessor;

  constructor() {
    console.log("VitalSignsProcessor: Inicializando con configuración optimizada");
    
    // Configurar TensorFlow
    tf.setBackend(OPTIMIZED_TENSORFLOW_CONFIG.backend);
    tf.ready().then(() => {
      console.log("TensorFlow inicializado con backend:", tf.getBackend());
    });

    // Inicializar procesadores especializados
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    this.hydrationEstimator = new HydrationEstimator();
    this.hydrationProcessor = new HydrationProcessor();
    
    // Inicializar validadores y calculadores con umbrales optimizados
    this.signalValidator = new SignalValidator(0.005, 25);
    this.confidenceCalculator = new ConfidenceCalculator(0.25);
    
    // Inicializar buffer de señal
    this.signalBuffer = new Float32Array(this.BUFFER_SIZE);
    
    // Inicializar worker si está disponible
    if (typeof Worker !== 'undefined') {
      this.initializeWorker();
    }

    this.bloodPressureProcessor = new BloodPressureProcessor();
    console.log("VitalSignsProcessor: Initialized with all components");
  }

  private initializeWorker() {
    try {
      this.processingWorker = new Worker('signal-processing.worker.js');
      this.processingWorker.onmessage = (e) => this.handleWorkerMessage(e);
    } catch (error) {
      console.error("Error al inicializar worker:", error);
      this.processingWorker = null;
    }
  }

  private handleWorkerMessage(e: MessageEvent) {
    // Procesar resultados del worker
    const { type, data } = e.data;
    if (type === 'processedSignal') {
      // Actualizar resultados con datos procesados
      this.updateProcessedResults(data as ProcessedSignalData);
    }
  }

  private updateProcessedResults(data: ProcessedSignalData) {
    this.lastValidResults = {
      spo2: data.spo2,
      pressure: { systolic: 0, diastolic: 0 },
      glucose: data.glucose,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hydration: data.hydration,
      arrhythmia: data.arrhythmiaStatus === "--" ? null : {
        arrhythmiaStatus: data.arrhythmiaStatus,
        confidence: 0
      },
      confidence: 0,
      timestamp: Date.now()
    };
  }

  private async processSignalSync(signal: Float32Array, rrData?: { intervals: number[]; lastPeakTime: number | null }): Promise<VitalSignsResult> {
    // Convertir Float32Array a number[] para procesamiento
    const signalArray = Array.from(signal);
    
    // Aplicar filtrado optimizado y extraer el valor filtrado
    const filterResult = this.signalProcessor.applyFilters(signalArray[0]);
    
    const processedSignal: ProcessedSignal = {
      value: signalArray,
      filteredValue: [filterResult.filteredValue],
      quality: filterResult.quality,
      fingerDetected: filterResult.fingerDetected,
      timestamp: Date.now(),
      roi: {
        x: 0,
        y: 0,
        width: signalArray.length,
        height: 1
      }
    };
    
    // Procesar señales vitales de forma paralela
    const [spo2Data, pressureData, glucoseData, lipidsData, hydrationData, arrhythmiaData] = await Promise.all([
      this.processSpO2(processedSignal),
      this.processBloodPressure(processedSignal),
      this.processGlucose(processedSignal),
      this.processLipids(processedSignal),
      this.processHydration(processedSignal),
      rrData ? this.processArrhythmia(processedSignal, rrData) : Promise.resolve(null)
    ]);

    // Calcular confianza general
    const signalConfidence = this.calculateSignalConfidence(processedSignal);
    const processingConfidence = this.calculateProcessingConfidence(spo2Data, pressureData, glucoseData, lipidsData);
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      signalConfidence,
      processingConfidence
    );

    return this.createFinalResults(
      spo2Data,
      pressureData,
      arrhythmiaData,
      glucoseData,
      lipidsData,
      hydrationData,
      signalConfidence,
      processingConfidence,
      overallConfidence
    );
  }

  public async processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): Promise<VitalSignsResult> {
    // Validación inicial de señal
    if (!this.signalValidator.isValidSignal(ppgValue)) {
      return ResultFactory.createEmptyResults();
    }

    // Actualizar buffer circular
    this.updateSignalBuffer(ppgValue);

    // Si no hay suficientes muestras, retornar resultados vacíos
    if (this.getValidSamplesCount() < this.MIN_SAMPLES_FOR_ANALYSIS) {
      return ResultFactory.createEmptyResults();
    }

    // Procesar señal con worker si está disponible
    if (this.processingWorker) {
      this.processingWorker.postMessage({
        type: 'processSignal',
        data: {
          signal: Array.from(this.signalBuffer),
          rrData
        }
      });
      return this.getLastValidResults();
    }

    // Procesamiento síncrono si no hay worker
    return this.processSignalSync(this.signalBuffer, rrData);
  }

  private updateSignalBuffer(value: number): void {
    // Desplazar buffer y agregar nuevo valor
    this.signalBuffer.set(this.signalBuffer.subarray(1));
    this.signalBuffer[this.signalBuffer.length - 1] = value;
  }

  private getValidSamplesCount(): number {
    let count = 0;
    for (let i = this.signalBuffer.length - 1; i >= 0; i--) {
      if (this.signalBuffer[i] !== 0) count++;
      else break;
    }
    return count;
  }

  private prepareSignal(signal: ProcessedSignal): number[] {
    return signal.filteredValue || signal.value;
  }

  async processSpO2(signal: ProcessedSignal): Promise<number> {
    const preparedSignal = this.prepareSignal(signal);
    return this.spo2Processor.calculateSpO2(preparedSignal);
  }

  async processBloodPressure(signal: ProcessedSignal): Promise<{ systolic: number; diastolic: number }> {
    const preparedSignal = this.prepareSignal(signal);
    const bp = this.bpProcessor.calculateBloodPressure(preparedSignal);
    return {
      systolic: Math.round(bp.systolic),
      diastolic: Math.round(bp.diastolic)
    };
  }

  async processGlucose(signal: ProcessedSignal): Promise<number> {
    const preparedSignal = this.prepareSignal(signal);
    return this.glucoseProcessor.calculateGlucose(preparedSignal);
  }

  async processLipids(signal: ProcessedSignal): Promise<LipidsResult> {
    const preparedSignal = this.prepareSignal(signal);
    const result = this.lipidProcessor.calculateLipids(preparedSignal);
    return {
      totalCholesterol: result.totalCholesterol,
      triglycerides: result.triglycerides
    };
  }

  async processHydration(signal: ProcessedSignal): Promise<number> {
    const preparedSignal = this.prepareSignal(signal);
    return this.hydrationProcessor.calculateHydration(preparedSignal);
  }

  async processArrhythmia(signal: ProcessedSignal, rrData: RRData): Promise<ArrhythmiaProcessingResult | null> {
    const preparedSignal = this.prepareSignal(signal);
    const result = this.arrhythmiaProcessor.processRRData(rrData);
    if (result.arrhythmiaStatus !== "--") {
      this.arrhythmiaCounter++;
    }
    return result.arrhythmiaStatus === "--" ? null : {
      arrhythmiaStatus: result.arrhythmiaStatus,
      confidence: 0.85 // Valor por defecto de confianza
    };
  }

  private formatPressure(bp: { systolic: number; diastolic: number }): string {
    return bp.systolic > 0 && bp.diastolic > 0 
      ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` 
      : "--/--";
  }

  private calculateSignalConfidence(signal: ProcessedSignal): number {
    return signal.quality;
  }

  private calculateProcessingConfidence(
    spo2: number,
    pressure: { systolic: number; diastolic: number },
    glucose: number,
    lipids: LipidsResult
  ): number {
    // Implementar lógica de confianza basada en los resultados
    return 0.85; // Valor por defecto
  }

  private createFinalResults(
    spo2: number,
    pressure: { systolic: number; diastolic: number },
    arrhythmiaResult: ArrhythmiaProcessingResult | null,
    glucose: number,
    lipids: LipidsResult,
    hydration: number,
    glucoseConfidence: number,
    lipidsConfidence: number,
    overallConfidence: number
  ): VitalSignsResult {
    const meetsThreshold = this.confidenceCalculator.meetsThreshold.bind(this.confidenceCalculator);

    return {
      spo2,
      pressure,
      glucose: meetsThreshold(glucoseConfidence) ? glucose : 0,
      lipids: meetsThreshold(lipidsConfidence) ? lipids : {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hydration,
      arrhythmia: arrhythmiaResult,
      confidence: overallConfidence,
      timestamp: Date.now()
    };
  }

  private calculateHemoglobin(spo2: number): number {
    return Math.round(spo2 * 0.15 + 2);
  }

  public reset(): VitalSignsResult | null {
    this.signalBuffer.fill(0);
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.hydrationProcessor.reset();
    this.lastValidResults = null;
    this.arrhythmiaCounter = 0;
    
    if (this.processingWorker) {
      this.processingWorker.postMessage({ type: 'reset' });
    }
    
    return null;
  }

  private getLastValidResults(): VitalSignsResult {
    return this.lastValidResults || ResultFactory.createEmptyResults();
  }

  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from '../../types/vital-signs';
