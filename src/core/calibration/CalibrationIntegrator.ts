import { getCalibrationSystem, MeasurementData, ProcessedMeasurement, CalibrationState, IntelligentCalibrationSystem, MeasurementType } from './IntelligentCalibrationSystem';
import { TensorFlowWorkerClient } from "@/workers/tensorflow-worker-client";
import { getModel } from "@/core/neural/ModelRegistry";
import { HeartRateNeuralModel } from '../neural/HeartRateModel';
import { SpO2NeuralModel } from '../neural/SpO2Model';
import { BloodPressureNeuralModel } from '../neural/BloodPressureModel';
import { GlucoseNeuralModel } from '../neural/GlucoseModel';

/**
 * Integrador del Sistema de Calibración con la aplicación
 * 
 * Esta clase ofrece un punto de entrada simplificado para integrar
 * el sistema de calibración inteligente con el resto de la aplicación.
 */
export class CalibrationIntegrator {
  private static _instance: CalibrationIntegrator | null = null;
  
  private calibrationSystem: IntelligentCalibrationSystem;
  private lastProcessedData: MeasurementData | null = null;
  private tfWorkerClient: TensorFlowWorkerClient | null = null;
  private isTfWorkerInitialized: boolean = false;
  
  private readonly MIN_QUALITY_FOR_NEURAL = 60;
  
  private constructor() {
    this.calibrationSystem = getCalibrationSystem();
    this.initializeTensorFlowWorker();
  }
  
  private async initializeTensorFlowWorker(): Promise<void> {
    if (this.tfWorkerClient && this.isTfWorkerInitialized) {
      console.log("TF Worker Client already initialized.");
      return;
    }
    if (!this.tfWorkerClient) {
      console.log("Initializing TensorFlow Worker Client in CalibrationIntegrator...");
      this.tfWorkerClient = new TensorFlowWorkerClient();
      try {
        await this.tfWorkerClient.initialize();
        this.isTfWorkerInitialized = true;
        console.log("TensorFlow Worker Client initialized successfully.");
      } catch (error) {
        console.error("FATAL: Error initializing TensorFlow Worker Client:", error);
        this.tfWorkerClient = null;
        this.isTfWorkerInitialized = false;
      }
    }
  }
  
  public static getInstance(): CalibrationIntegrator {
    if (!CalibrationIntegrator._instance) {
      CalibrationIntegrator._instance = new CalibrationIntegrator();
    }
    return CalibrationIntegrator._instance;
  }
  
  /**
   * Procesa una medición mediante el sistema de calibración y los modelos neuronales
   */
  public async processMeasurement(rawData: {
    ppgValues: number[];
    heartRate: number;
    spo2: number;
    systolic: number;
    diastolic: number;
    glucose: number;
    quality: number;
  }): Promise<{
    heartRate: number;
    spo2: number;
    systolic: number;
    diastolic: number;
    glucose: number;
    quality: number;
    isCalibrated: boolean;
  }> {
    const { ppgValues, quality } = rawData;
    const calibrationState = this.calibrationSystem.getCalibrationState();
    const correctionFactors = calibrationState.correctionFactors;

    let neuralResults: NeuralModelResults | null = null;

    if (quality >= this.MIN_QUALITY_FOR_NEURAL) {
      console.time("NeuralModelProcessing");
      neuralResults = await this.applyNeuralModels(ppgValues);
      console.timeEnd("NeuralModelProcessing");
    } else {
      console.log(`Skipping Neural Network processing due to low quality (${quality} < ${this.MIN_QUALITY_FOR_NEURAL})`);
    }

    let combinedHeartRate = rawData.heartRate;
    let combinedSpo2 = rawData.spo2;
    let combinedSystolic = rawData.systolic;
    let combinedDiastolic = rawData.diastolic;
    let combinedGlucose = rawData.glucose;

    if (neuralResults) {
      const weightNeural = Math.max(0, Math.min(1, (quality - this.MIN_QUALITY_FOR_NEURAL) / (100 - this.MIN_QUALITY_FOR_NEURAL)));
      const weightTraditional = 1 - weightNeural;

      combinedHeartRate = (neuralResults.heartRate * weightNeural) + (rawData.heartRate * weightTraditional);
      combinedSpo2 = (neuralResults.spo2 * weightNeural) + (rawData.spo2 * weightTraditional);
      combinedSystolic = (neuralResults.systolic * weightNeural) + (rawData.systolic * weightTraditional);
      combinedDiastolic = (neuralResults.diastolic * weightNeural) + (rawData.diastolic * weightTraditional);
      combinedGlucose = (neuralResults.glucose * weightNeural) + (rawData.glucose * weightTraditional);
    }

    const finalHeartRate = combinedHeartRate * correctionFactors.heartRate;
    const finalSpo2 = combinedSpo2 * correctionFactors.spo2;
    const finalSystolic = combinedSystolic * correctionFactors.systolic;
    const finalDiastolic = combinedDiastolic * correctionFactors.diastolic;
    const finalGlucose = combinedGlucose * correctionFactors.glucose;

    const clampedSpo2 = Math.min(100, Math.max(85, finalSpo2 || 0));
    const clampedSystolic = Math.min(200, Math.max(80, finalSystolic || 0));
    let clampedDiastolic = Math.min(130, Math.max(50, finalDiastolic || 0));
    if (clampedDiastolic >= clampedSystolic) {
       clampedDiastolic = Math.max(50, clampedSystolic - 10);
    }

    const isCalibrated = calibrationState.phase === 'active';

    const measurementForSystem: MeasurementData = {
       timestamp: Date.now(),
       heartRate: finalHeartRate,
       spo2: clampedSpo2,
       systolic: clampedSystolic,
       diastolic: clampedDiastolic,
       glucose: finalGlucose,
       quality: quality,
    };
    this.calibrationSystem.processMeasurement(measurementForSystem);

    this.lastProcessedData = measurementForSystem;

    return {
      heartRate: Math.round(finalHeartRate),
      spo2: Math.round(clampedSpo2),
      systolic: Math.round(clampedSystolic),
      diastolic: Math.round(clampedDiastolic),
      glucose: Math.round(finalGlucose),
      quality: quality,
      isCalibrated: isCalibrated,
    };
  }
  
  /**
   * Aplica modelos neuronales para obtener estimaciones independientes
   */
  private async applyNeuralModels(ppgValues: number[]): Promise<NeuralModelResults> {
    if (!this.isTfWorkerInitialized || !this.tfWorkerClient) {
        console.warn("TF Worker not initialized. Returning default NN results.");
        return { heartRate: 75, spo2: 98, systolic: 120, diastolic: 80, glucose: 95 };
    }

    let results: NeuralModelResults = {
      heartRate: 75, spo2: 98, systolic: 120, diastolic: 80, glucose: 95,
    };

    const predictWithFallback = async (modelType: 'heartRate' | 'spo2' | 'bloodPressure' | 'glucose') => {
      const client = this.tfWorkerClient!;
      try {
        const modelStatus = client.getModelStatus(modelType);
        if (modelStatus === 'ready') {
          console.time(`NN Predict ${modelType}`);
          const predictionResult = await client.predict(modelType, ppgValues);
          console.timeEnd(`NN Predict ${modelType}`);

          if (modelType === 'bloodPressure') {
            if (predictionResult && predictionResult.length >= 2) {
              results.systolic = Math.round(predictionResult[0]);
              results.diastolic = Math.round(predictionResult[1]);
            } else {
              console.warn(`Neural ${modelType} prediction returned invalid result:`, predictionResult);
            }
          } else if (predictionResult && predictionResult.length > 0) {
             results[modelType] = Math.round(predictionResult[0]);
          } else {
             console.warn(`Neural ${modelType} prediction returned empty or invalid result:`, predictionResult);
          }
        } else {
          console.warn(`TF Worker model ${modelType} not ready (Status: ${modelStatus}). Using fallback.`);
        }
      } catch (error) {
        console.error(`Error during neural model prediction for ${modelType}:`, error);
      }
    };

    await Promise.all([
        predictWithFallback('heartRate'),
        predictWithFallback('spo2'),
        predictWithFallback('bloodPressure'),
        predictWithFallback('glucose')
    ]);

    console.log("Neural Network Results:", results);
    return results;
  }
  
  /**
   * Inicia el proceso de calibración
   */
  public startCalibration(): void {
    console.log("Starting calibration via Integrator -> System");
    this.calibrationSystem.startCalibration();
  }
  
  /**
   * Cancela o reinicia la calibración
   */
  public resetCalibration(fullReset: boolean = false): void {
    console.log(`Resetting calibration (Full: ${fullReset}) via Integrator -> System`);
    this.calibrationSystem.resetCalibration(fullReset);
    this.lastProcessedData = null;
  }
  
  /**
   * Obtiene el estado actual de calibración
   */
  public getCalibrationState(): CalibrationState {
    return { ...this.calibrationSystem.getCalibrationState() };
  }
  
  /**
   * Proporciona retroalimentación externa (ej. de un dispositivo médico de referencia)
   */
  public provideExternalReference(type: MeasurementType, value: number | { systolic: number, diastolic: number }): void {
    console.log(`Providing external reference for ${type} via Integrator -> System`);
    this.calibrationSystem.setReferenceValue(type, value);
  }
  
  /**
   * Actualiza la configuración del sistema de calibración
   */
  public updateCalibrationConfig(config: Partial<CalibrationConfig>): void {
    console.log("Updating calibration config via Integrator -> System");
    this.calibrationSystem.updateConfig(config);
  }
}
