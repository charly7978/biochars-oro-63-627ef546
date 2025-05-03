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
import { SpO2NeuralModel } from '../../core/neural/SpO2Model';
import { BloodPressureNeuralModel } from '../../core/neural/BloodPressureModel';
import { getModel } from '../../core/neural/ModelRegistry';
import { PeakDetector } from '../../core/signal/PeakDetector';

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
  
  // Instancias de modelos neuronales (opcional, se pueden obtener con getModel)
  private spo2Model: SpO2NeuralModel | null;
  private bpModel: BloodPressureNeuralModel | null;
  
  // Detector de picos para fallback de HR
  private peakDetector: PeakDetector;
  
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
    this.signalValidator = new SignalValidator(0.01, 15);
    this.confidenceCalculator = new ConfidenceCalculator(0.15);

    // Obtener instancias de modelos neuronales
    this.spo2Model = getModel<SpO2NeuralModel>('spo2');
    this.bpModel = getModel<BloodPressureNeuralModel>('bloodPressure');
    
    // Inicializar detector de picos
    this.peakDetector = new PeakDetector();

    this.reset();
  }
  
  /**
   * Inicializa asíncronamente los modelos neuronales
   */
  private async initModels() {
    try {
      // Obtener modelos de forma asíncrona
      this.spo2Model = await ModelRegistry.getInstance().getModel<SpO2NeuralModel>('spo2');
      this.bpModel = await ModelRegistry.getInstance().getModel<BloodPressureNeuralModel>('bloodPressure');
      console.log("VitalSignsProcessor: Modelos neuronales cargados");
    } catch (error) {
      console.error("VitalSignsProcessor: Error al cargar modelos neuronales", error);
    }
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
    
    // Procesamiento directo usando los valores reales
    let heartRate = 0;
    let spo2 = 0;
    let pressure = "--/--";
    let systolic = 0;
    let diastolic = 0;
    let glucose = 0;
    let glucoseConfidence = 0; // Declarar fuera del if con valor por defecto
    let overallConfidence = 0; // Declarar fuera del if con valor por defecto
    
    const currentSignalSlice = this.signalBufferRed.slice(-100); // Asegúrate que esta línea exista ANTES del if

    // Solo calculamos mediciones si tenemos suficientes datos y señal estable
    if (hasEnoughData && amplitude > 0.005 && this.isStabilized) {
      
      // Estimar SpO2 usando modelo NN
      if (this.spo2Model) {
        try {
          // Pasar el array directamente, el modelo maneja la conversión a Tensor
          const spo2Result = this.spo2Model.predict(currentSignalSlice); 
          spo2 = spo2Result[0]; // Asumiendo que predict devuelve number[]
        } finally {
          // La gestión de tensores debe ocurrir dentro del modelo
        }
      } else {
        spo2 = 0; // No hay modelo disponible
      }
      
      // Estimar Presión Arterial usando modelo NN
      if (this.bpModel) {
        try {
          // Pasar el array directamente, el modelo maneja la conversión a Tensor
          const bpResultNN = this.bpModel.predict(currentSignalSlice); 
          systolic = bpResultNN[0];
          diastolic = bpResultNN[1];
          if (systolic > 0 && diastolic > 0 && systolic > diastolic) {
            pressure = `${Math.round(systolic)}/${Math.round(diastolic)}`;
          } else {
            pressure = "--/--";
          }
        } finally {
          // La gestión de tensores debe ocurrir dentro del modelo
        }
      } else {
        pressure = "--/--"; // No hay modelo disponible
      }
      
      // Calcular frecuencia cardíaca
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
      } else {
        // Fallback: Calcular HR desde picos PPG si no hay RR válidos
        // Pasar el array directamente
        const { peakIndices } = this.peakDetector.detectPeaks(currentSignalSlice); 
        if (peakIndices.length >= 2) {
          const intervalsMs = peakIndices.slice(1).map((pkIdx, i) => 
            (pkIdx - peakIndices[i]) * (1000 / 60) // Asumiendo 60fps aprox.
          ).filter(interval => interval > 300 && interval < 1500);
          if (intervalsMs.length > 0) {
            const avgInterval = intervalsMs.reduce((s, v) => s + v, 0) / intervalsMs.length;
            heartRate = Math.round(60000 / avgInterval);
            heartRate = Math.max(40, Math.min(200, heartRate)); // Clamp
          }
        }
      } 
      // Por ahora, si no hay RR, heartRate permanecerá en 0 si no se calcula en otro lado.
      
      // Calcular glucosa con procesamiento directo
      glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
      
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
