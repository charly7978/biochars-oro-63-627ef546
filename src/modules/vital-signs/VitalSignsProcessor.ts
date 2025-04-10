
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Import necessary processors
import { BloodPressureProcessor } from './blood-pressure-processor';
import { SpO2Processor } from './spo2-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { ResultFactory } from './factories/result-factory';
import { SignalValidator } from './validators/signal-validator';
import { ConfidenceCalculator } from './calculators/confidence-calculator';
import { VitalSignsResult, LipidsResult, ArrhythmiaProcessingResult, RRData } from '../../types/vital-signs';
import { HydrationProcessor } from './hydration-processor';
import { OPTIMIZED_TENSORFLOW_CONFIG } from '../../core/neural/tensorflow/TensorFlowConfig';
import * as tf from '@tensorflow/tfjs';
import { ProcessedSignal } from '../../types/signal';
import { SignalProcessor } from './signal-processor';

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
 * Main processor class for vital signs
 */
export class VitalSignsProcessor {
  // Processors for each vital sign
  private bloodPressureProcessor: BloodPressureProcessor;
  private spo2Processor: SpO2Processor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  private hydrationProcessor: HydrationProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;

  // Buffer for PPG signal
  private ppgBuffer: number[] = [];
  private readonly BUFFER_SIZE = 300;
  private readonly MIN_SAMPLES_FOR_ANALYSIS = 200;
  private lastValidResults: VitalSignsResult | null = null;
  private arrhythmiaCounter: number = 0;
  private signalBuffer: Float32Array;

  constructor() {
    console.log("VitalSignsProcessor: Initializing with optimized configuration");
    
    // Configure TensorFlow
    tf.setBackend(OPTIMIZED_TENSORFLOW_CONFIG.backend || 'webgl');
    tf.ready().then(() => {
      console.log("TensorFlow initialized with backend:", tf.getBackend());
    });

    // Initialize all processors
    this.bloodPressureProcessor = new BloodPressureProcessor();
    this.spo2Processor = new SpO2Processor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    this.hydrationProcessor = new HydrationProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    
    // Initialize validators and calculators with optimized thresholds
    this.signalValidator = new SignalValidator(0.005, 25);
    this.confidenceCalculator = new ConfidenceCalculator(0.25);
    
    // Initialize signal buffer
    this.signalBuffer = new Float32Array(this.BUFFER_SIZE);
    
    console.log("VitalSignsProcessor: Initialized with all components");
  }

  private updateSignalBuffer(value: number): void {
    // Shift buffer and add new value
    this.signalBuffer.set(this.signalBuffer.subarray(1));
    this.signalBuffer[this.signalBuffer.length - 1] = value;
  }

  /**
   * Process a single PPG signal value
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Add to buffer
    this.ppgBuffer.push(ppgValue);
    if (this.ppgBuffer.length > this.BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }

    this.updateSignalBuffer(ppgValue);

    // Calculate each vital sign
    const bloodPressure = this.bloodPressureProcessor.calculateBloodPressure(this.ppgBuffer);
    const spO2 = this.spo2Processor.calculateSpO2(this.ppgBuffer);
    const glucose = this.glucoseProcessor.calculateGlucose(this.ppgBuffer);
    const lipids = this.lipidProcessor.calculateLipids(this.ppgBuffer);
    const hydration = this.hydrationProcessor.calculateHydration(this.ppgBuffer);

    // Process arrhythmia using RR intervals
    const arrhythmia = this.arrhythmiaProcessor.processRRData(rrData);
    
    if (arrhythmia.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED")) {
      this.arrhythmiaCounter++;
    }

    // Return combined results
    return {
      spO2,
      bloodPressure,
      glucose,
      lipids,
      hydration,
      arrhythmia: arrhythmia.arrhythmiaStatus === "--" ? null : {
        arrhythmiaStatus: arrhythmia.arrhythmiaStatus,
        lastArrhythmiaData: arrhythmia.lastArrhythmiaData
      }
    };
  }

  /**
   * Reset all processors
   */
  public reset(): VitalSignsResult | null {
    this.bloodPressureProcessor.reset();
    this.spo2Processor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.hydrationProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.signalBuffer.fill(0);
    this.ppgBuffer = [];
    this.lastValidResults = null;
    this.arrhythmiaCounter = 0;
    
    console.log("VitalSignsProcessor: All processors reset");
    return null;
  }

  /**
   * Full reset of all components
   */
  public fullReset(): void {
    this.reset();
    console.log("VitalSignsProcessor: Full system reset completed");
  }

  /**
   * Get the current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }
}
