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
  private readonly BUFFER_SIZE = 1000; // Buffer más grande para mejor análisis
  private readonly MIN_SAMPLES_FOR_ANALYSIS = 200;
  private processingWorker: Worker | null = null;
  private lastValidResults: VitalSignsResult | null = null;

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
    
    // Inicializar validadores y calculadores con umbrales optimizados
    this.signalValidator = new SignalValidator(0.005, 25);
    this.confidenceCalculator = new ConfidenceCalculator(0.25);
    
    // Inicializar buffer de señal
    this.signalBuffer = new Float32Array(this.BUFFER_SIZE);
    
    // Inicializar worker si está disponible
    if (typeof Worker !== 'undefined') {
      this.initializeWorker();
    }
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
      lipids: { ldl: 0, hdl: 0, triglycerides: 0 },
      hydration: data.hydration,
      arrhythmia: data.arrhythmiaStatus === "--" ? null : { type: data.arrhythmiaStatus, confidence: 0 },
      confidence: 0,
      timestamp: Date.now()
    };
  }

  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
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

  private processSignalSync(signal: Float32Array, rrData?: { intervals: number[]; lastPeakTime: number | null }): VitalSignsResult {
    // Aplicar filtrado optimizado y extraer el valor filtrado
    const processedSignal = this.signalProcessor.applyFilters(Array.from(signal));
    const filtered = new Float32Array(processedSignal.filteredValue);
    
    // Procesar señales vitales
    const spo2Data = this.processSpO2(filtered);
    const pressureData = this.processBloodPressure(filtered);
    const glucoseData = this.processGlucose(filtered);
    const lipidsData = this.processLipids(filtered);
    const hydrationData = this.processHydration(filtered);
    
    // Procesar arritmias si hay datos RR válidos
    const arrhythmiaData = rrData ? this.processArrhythmia(filtered, rrData) : null;
    
    // Calcular confianza general
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence({
      spo2: spo2Data,
      pressure: pressureData,
      glucose: glucoseData,
      lipids: lipidsData,
      hydration: hydrationData,
      arrhythmia: arrhythmiaData
    });

    return {
      spo2: spo2Data,
      pressure: pressureData,
      glucose: glucoseData,
      lipids: lipidsData,
      hydration: hydrationData,
      arrhythmia: arrhythmiaData,
      confidence: overallConfidence,
      timestamp: Date.now()
    };
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
    return this.hydrationEstimator.analyze(preparedSignal);
  }

  async processArrhythmia(signal: ProcessedSignal, rrData: RRData): Promise<ArrhythmiaProcessingResult> {
    const preparedSignal = this.prepareSignal(signal);
    const result = this.arrhythmiaProcessor.processRRData(rrData);
    return result.arrhythmiaStatus === "--" ? null : {
      arrhythmiaStatus: result.arrhythmiaStatus,
      confidence: result.confidence
    };
  }

  private formatPressure(bp: { systolic: number; diastolic: number }): string {
    return bp.systolic > 0 && bp.diastolic > 0 
      ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` 
      : "--/--";
  }

  private calculateOverallConfidence(
    glucoseConf: number,
    lipidsConf: number
  ): number {
    return this.confidenceCalculator.calculateOverallConfidence(
      glucoseConf,
      lipidsConf
    );
  }

  private createFinalResults(
    spo2: number,
    pressure: string,
    arrhythmiaResult: any,
    glucose: number,
    lipids: any,
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
      lipids: meetsThreshold(lipidsConfidence) ? {
        totalCholesterol: Math.round(lipids.totalCholesterol),
        triglycerides: Math.round(lipids.triglycerides)
      } : {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hydration,
      arrhythmia: arrhythmiaResult.arrhythmiaStatus === "--" ? null : { type: arrhythmiaResult.arrhythmiaStatus, confidence: arrhythmiaResult.confidence },
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
    this.hydrationEstimator.reset();
    this.lastValidResults = null;
    
    if (this.processingWorker) {
      this.processingWorker.postMessage({ type: 'reset' });
    }
    
    return null;
  }

  private getLastValidResults(): VitalSignsResult {
    return this.lastValidResults || ResultFactory.createEmptyResults();
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from '../../types/vital-signs';
