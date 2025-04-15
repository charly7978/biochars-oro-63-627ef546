import { getCalibrationSystem, MeasurementData, ProcessedMeasurement, CalibrationState, IntelligentCalibrationSystem, MeasurementType, CalibrationConfig } from './IntelligentCalibrationSystem';
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

// *** Mover la definición de la interfaz aquí ***
interface NeuralModelResults {
  heartRate: number;
  spo2: number;
  systolic: number;
  diastolic: number;
  glucose: number;
}

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

    console.log(`[Calibration Phase: ${calibrationState.phase}] Factors: HR=${correctionFactors.heartRate?.toFixed(3)}, SpO2=${correctionFactors.spo2?.toFixed(3)}, Sys=${correctionFactors.systolic?.toFixed(3)}, Dia=${correctionFactors.diastolic?.toFixed(3)}, Gluc=${correctionFactors.glucose?.toFixed(3)}`);

    let neuralResults: NeuralModelResults | null = null;

    if (quality >= this.MIN_QUALITY_FOR_NEURAL) {
      console.time("NeuralModelProcessing");
      neuralResults = await this.applyNeuralModels(ppgValues);
      console.timeEnd("NeuralModelProcessing");
    } else {
      console.log(`[DIAG] Skipping NN processing (Quality: ${quality} < ${this.MIN_QUALITY_FOR_NEURAL})`);
    }

    let baseHeartRate = rawData.heartRate;
    let baseSpo2 = rawData.spo2;
    let baseSystolic = rawData.systolic;
    let baseDiastolic = rawData.diastolic;
    let baseGlucose = rawData.glucose;

    let combinedHeartRate = baseHeartRate;
    let combinedSpo2 = baseSpo2;
    let combinedSystolic = baseSystolic;
    let combinedDiastolic = baseDiastolic;
    let combinedGlucose = baseGlucose;

    if (neuralResults) {
      const weightNeural = Math.max(0, Math.min(1, (quality - this.MIN_QUALITY_FOR_NEURAL) / (100 - this.MIN_QUALITY_FOR_NEURAL)));
      const weightTraditional = 1 - weightNeural;

      console.log(`[DIAG] Combining: Quality=${quality}, WeightNeural=${weightNeural.toFixed(2)}`);
      console.log(`[DIAG] HR: Trad=${baseHeartRate}, NN=${neuralResults.heartRate}`);
      console.log(`[DIAG] SpO2: Trad=${baseSpo2}, NN=${neuralResults.spo2}`);
      console.log(`[DIAG] BP: Trad=${baseSystolic}/${baseDiastolic}, NN=${neuralResults.systolic}/${neuralResults.diastolic}`);
      console.log(`[DIAG] Gluc: Trad=${baseGlucose}, NN=${neuralResults.glucose}`);

      combinedHeartRate = (neuralResults.heartRate * weightNeural) + (baseHeartRate * weightTraditional);
      combinedSpo2 = (neuralResults.spo2 * weightNeural) + (baseSpo2 * weightTraditional);
      combinedSystolic = (neuralResults.systolic * weightNeural) + (baseSystolic * weightTraditional);
      combinedDiastolic = (neuralResults.diastolic * weightNeural) + (baseDiastolic * weightTraditional);
      combinedGlucose = (neuralResults.glucose * weightNeural) + (baseGlucose * weightTraditional);

      console.log(`[DIAG] Combined values -> HR:${combinedHeartRate.toFixed(1)}, SpO2:${combinedSpo2.toFixed(1)}, BP:${combinedSystolic.toFixed(1)}/${combinedDiastolic.toFixed(1)}, Gluc:${combinedGlucose.toFixed(1)}`);
    } else {
       console.log("[DIAG] Using only traditional values (NN skipped or failed).");
    }

    console.log(` -> Before Corr: HR=${combinedHeartRate?.toFixed(1)}, SpO2=${combinedSpo2?.toFixed(1)}, BP=${combinedSystolic?.toFixed(1)}/${combinedDiastolic?.toFixed(1)}, Gluc=${combinedGlucose?.toFixed(1)}`);

    const finalHeartRate = (combinedHeartRate || 0) * (correctionFactors.heartRate || 1);
    const finalSpo2 = (combinedSpo2 || 0) * (correctionFactors.spo2 || 1);
    const finalSystolic = (combinedSystolic || 0) * (correctionFactors.systolic || 1);
    const finalDiastolic = (combinedDiastolic || 0) * (correctionFactors.diastolic || 1);
    const finalGlucose = (combinedGlucose || 0) * (correctionFactors.glucose || 1);

    console.log(` -> After Corr:  HR=${finalHeartRate?.toFixed(1)}, SpO2=${finalSpo2?.toFixed(1)}, BP=${finalSystolic?.toFixed(1)}/${finalDiastolic?.toFixed(1)}, Gluc=${finalGlucose?.toFixed(1)}`);

    const clampedSpo2 = Math.min(100, Math.max(85, finalSpo2 || 0));
    const clampedSystolic = Math.min(200, Math.max(80, finalSystolic || 0));
    let clampedDiastolic = Math.min(130, Math.max(50, finalDiastolic || 0));
    if (clampedDiastolic >= clampedSystolic) {
       clampedDiastolic = Math.max(50, clampedSystolic - 10);
    }
    const clampedHeartRate = Math.min(220, Math.max(30, finalHeartRate || 0));
    const clampedGlucose = Math.min(400, Math.max(50, finalGlucose || 0));

    const isCalibrated = calibrationState.phase === 'active';

    const measurementForSystem: MeasurementData = {
       timestamp: Date.now(),
       heartRate: clampedHeartRate,
       spo2: clampedSpo2,
       systolic: clampedSystolic,
       diastolic: clampedDiastolic,
       glucose: clampedGlucose,
       quality: quality,
    };
    this.calibrationSystem.processMeasurement(measurementForSystem);

    this.lastProcessedData = measurementForSystem;

    const finalResult = {
      heartRate: Math.round(clampedHeartRate),
      spo2: Math.round(clampedSpo2),
      systolic: Math.round(clampedSystolic),
      diastolic: Math.round(clampedDiastolic),
      glucose: Math.round(clampedGlucose),
      quality: quality,
      isCalibrated: isCalibrated,
    };

    console.log(`[DIAG] Final Processed Result -> HR:${finalResult.heartRate}, SpO2:${finalResult.spo2}, BP:${finalResult.systolic}/${finalResult.diastolic}, Gluc:${finalResult.glucose}, Quality:${finalResult.quality}, Calibrated:${finalResult.isCalibrated}`);

    return finalResult;
  }
  
  /**
   * Aplica modelos neuronales para obtener estimaciones independientes
   */
  private async applyNeuralModels(ppgValues: number[]): Promise<NeuralModelResults> {
    if (!this.isTfWorkerInitialized || !this.tfWorkerClient) {
        console.warn("TF Worker not initialized. Returning default NN results.");
        const defaultResults: NeuralModelResults = { heartRate: 75, spo2: 98, systolic: 120, diastolic: 80, glucose: 95 };
        return defaultResults;
    }

    let results: NeuralModelResults = {
      heartRate: 75, spo2: 98, systolic: 120, diastolic: 80, glucose: 95,
    };
    const client = this.tfWorkerClient!;

    const predictWithFallback = async (modelType: 'heartRate' | 'spo2' | 'bloodPressure' | 'glucose') => {
      try {
        const modelStatus = client.getModelStatus(modelType);
        if (modelStatus === 'ready') {
          console.time(`NN Predict ${modelType}`);
          const predictionResult = await client.predict(modelType, ppgValues);
          console.timeEnd(`NN Predict ${modelType}`);

          if (modelType === 'heartRate') {
              console.log(`[CalibrationIntegrator] Raw NN HR Prediction:`, predictionResult);
          }

          if (modelType === 'bloodPressure') {
            if (predictionResult && predictionResult.length >= 2 && !isNaN(predictionResult[0]) && !isNaN(predictionResult[1])) {
              results.systolic = Math.round(predictionResult[0]);
              results.diastolic = Math.round(predictionResult[1]);
              console.log(`[DIAG] Successful NN BP Prediction: ${results.systolic}/${results.diastolic}`);
            } else {
              console.warn(`[DIAG] Invalid NN BP prediction result. Raw:`, predictionResult, `Using fallback values (120/80).`);
              results.systolic = 120;
              results.diastolic = 80;
            }
          } else if (predictionResult && predictionResult.length > 0 && !isNaN(predictionResult[0])) {
             results[modelType] = Math.round(predictionResult[0]);
             console.log(`[DIAG] Successful NN ${modelType} Prediction:`, results[modelType]);
          } else {
             console.warn(`[DIAG] Invalid NN ${modelType} prediction result. Raw:`, predictionResult, `Using fallback value.`);
          }
        } else {
          console.warn(`[DIAG] TF Worker model ${modelType} not ready (Status: ${modelStatus}). Using fallback values.`);
        }
      } catch (error) {
        console.error(`[DIAG] Error during NN prediction for ${modelType}:`, error);
      }
    };

    await Promise.all([
        predictWithFallback('heartRate'),
        predictWithFallback('spo2'),
        predictWithFallback('bloodPressure'),
        predictWithFallback('glucose')
    ]);

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
