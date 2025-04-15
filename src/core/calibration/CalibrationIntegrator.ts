import { getCalibrationSystem, MeasurementData, ProcessedMeasurement, CalibrationState, IntelligentCalibrationSystem } from './IntelligentCalibrationSystem';
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
  private static instance: CalibrationIntegrator;
  
  private calibrationSystem: IntelligentCalibrationSystem = getCalibrationSystem();
  private lastProcessedData: MeasurementData | null = null;
  private tfWorkerClient: TensorFlowWorkerClient;
  
  private constructor() {
    // Inicializar el worker client
    // Es crucial manejar la inicialización asíncrona correctamente
    console.log("Initializing TensorFlow Worker Client in CalibrationIntegrator...");
    this.tfWorkerClient = new TensorFlowWorkerClient();
    this.tfWorkerClient.initialize()
      .then(() => console.log("TensorFlow Worker Client initialized successfully."))
      .catch(error => {
        console.error("FATAL: Error initializing TensorFlow Worker Client in CalibrationIntegrator:", error);
        // Considerar un estado de error global o mecanismo de reintento si es crítico
      });
  }
  
  /**
   * Obtiene la instancia del integrador
   */
  public static getInstance(): CalibrationIntegrator {
    if (!CalibrationIntegrator.instance) {
      CalibrationIntegrator.instance = new CalibrationIntegrator();
    }
    return CalibrationIntegrator.instance;
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

    // 1. Obtener predicciones de los modelos neuronales (ahora es asíncrono)
    console.time("NeuralModelPrediction");
    const neuralResults = await this.applyNeuralModels(ppgValues);
    console.timeEnd("NeuralModelPrediction");

    // 2. Estrategia de Combinación: Ponderación basada en calidad
    //    Mejorar esta lógica según sea necesario (ej. usar confianza del modelo si está disponible)
    const weightNeural = Math.max(0, Math.min(1, (quality - 50) / 40)); // Pondera más lo neural si la calidad > 50
    const weightTraditional = 1 - weightNeural;

    const combinedHeartRate = (neuralResults.heartRate * weightNeural) + (rawData.heartRate * weightTraditional);
    const combinedSpo2 = (neuralResults.spo2 * weightNeural) + (rawData.spo2 * weightTraditional);
    const combinedSystolic = (neuralResults.systolic * weightNeural) + (rawData.systolic * weightTraditional);
    const combinedDiastolic = (neuralResults.diastolic * weightNeural) + (rawData.diastolic * weightTraditional);
    const combinedGlucose = (neuralResults.glucose * weightNeural) + (rawData.glucose * weightTraditional);

    console.log(`Combined HR: ${combinedHeartRate.toFixed(1)}, SpO2: ${combinedSpo2.toFixed(1)}, BP: ${combinedSystolic.toFixed(1)}/${combinedDiastolic.toFixed(1)}, Gluc: ${combinedGlucose.toFixed(1)} (Weight Neural: ${weightNeural.toFixed(2)})`);

    // 3. Aplicar factores de calibración del IntelligentCalibrationSystem
    const finalHeartRate = combinedHeartRate * correctionFactors.heartRate;
    const finalSpo2 = combinedSpo2 * correctionFactors.spo2;
    const finalSystolic = combinedSystolic * correctionFactors.systolic;
    const finalDiastolic = combinedDiastolic * correctionFactors.diastolic;
    const finalGlucose = combinedGlucose * correctionFactors.glucose;

    // 4. Aplicar restricciones fisiológicas (ejemplo)
    const clampedSpo2 = Math.min(100, Math.max(85, finalSpo2)); // Rango SpO2 más realista
    const clampedSystolic = Math.min(200, Math.max(80, finalSystolic));
    const clampedDiastolic = Math.min(130, Math.max(50, clampedSystolic > 0 ? Math.min(clampedSystolic - 10, finalDiastolic) : finalDiastolic)); // Asegurar Diastólica < Sistólica

    const isCalibrated = calibrationState.phase === 'active';

    // 5. Actualizar el sistema de calibración con la medición PROCESADA (antes de redondear para UI)
    //    Decidir si pasarle los datos combinados, finales o crudos + neurales.
    //    Pasar los datos finales antes del redondeo parece razonable.
    const measurementForCalibration: MeasurementData = {
       timestamp: Date.now(),
       heartRate: finalHeartRate,
       spo2: clampedSpo2,
       systolic: clampedSystolic,
       diastolic: clampedDiastolic,
       glucose: finalGlucose,
       quality: quality,
       // rawSignal: ppgValues, // Opcional
       // Podríamos añadir environmentalFactors si estuvieran disponibles
    };
    this.calibrationSystem.processMeasurement(measurementForCalibration); // Informar al sistema de calibración

    // 6. Guardar y devolver el resultado final redondeado para la UI
    this.lastProcessedData = {
      ...measurementForCalibration, // Guardar los datos usados para calibración
       // Opcionalmente redondear aquí también si `lastProcessedData` es para mostrar
       // spo2: Math.round(clampedSpo2),
       // systolic: Math.round(clampedSystolic),
       // diastolic: Math.round(clampedDiastolic),
    };

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
  private async applyNeuralModels(ppgValues: number[]): Promise<{
    heartRate: number;
    spo2: number;
    systolic: number;
    diastolic: number;
    glucose: number;
  }> {
    // Valores por defecto o de fallback
    let neuralHeartRate = 75; // Valor de fallback
    let neuralSpo2 = 98; // Valor de fallback
    let neuralSystolic = 120; // Valor de fallback
    let neuralDiastolic = 80; // Valor de fallback
    let neuralGlucose = 95; // Valor de fallback

    try {
      // Intentar predecir HeartRate usando el worker
      // Asegurarse que el worker esté listo y el modelo cargado
      if (this.tfWorkerClient && this.tfWorkerClient.getModelStatus('heartRate') === 'ready') {
         // El preprocesamiento puede ser necesario aquí antes de enviar
         // const preprocessedPpg = TensorUtils.preprocessForModel(ppgValues, modelInputSize);
         // El modelo puede devolver más de un valor, ajusta según la salida real
        const predictionResult = await this.tfWorkerClient.predict('heartRate', ppgValues);
        if (predictionResult && predictionResult.length > 0) {
            neuralHeartRate = Math.round(predictionResult[0]); // Asumiendo que el primer valor es el BPM
            console.log("Neural HR Prediction:", neuralHeartRate);
        } else {
            console.warn("Neural HR prediction returned empty or invalid result.");
        }
      } else {
        console.warn("TF Worker or HeartRate model not ready for prediction.");
        // Fallback a modelo simulado si el worker no está listo
        const fallbackModel = getModel('heartRate');
        if (fallbackModel) {
           // Aplicar preprocesamiento si es necesario para el modelo TS
           // neuralHeartRate = fallbackModel.predict(preprocessedPpg)[0];
        }
      }

      // --- Repetir proceso similar para otros modelos (SpO2, BP, Glucose) ---

      // Ejemplo para SpO2 (requiere adaptar preprocesamiento y manejo de resultado)
      if (this.tfWorkerClient && this.tfWorkerClient.getModelStatus('spo2') === 'ready') {
        const predictionResult = await this.tfWorkerClient.predict('spo2', ppgValues);
         if (predictionResult && predictionResult.length > 0) {
            neuralSpo2 = Math.round(predictionResult[0]); // Ajustar índice y redondeo según sea necesario
            console.log("Neural SpO2 Prediction:", neuralSpo2);
         } else {
            console.warn("Neural SpO2 prediction returned empty or invalid result.");
         }
      } else {
        console.warn("TF Worker or SpO2 model not ready for prediction.");
        // Fallback a modelo simulado si el worker no está listo
         const fallbackModel = getModel('spo2');
         if (fallbackModel) {
            // neuralSpo2 = fallbackModel.predict(preprocessedPpg)[0];
         }
      }

       // Ejemplo para BloodPressure (devuelve 2 valores)
      if (this.tfWorkerClient && this.tfWorkerClient.getModelStatus('bloodPressure') === 'ready') {
        const predictionResult = await this.tfWorkerClient.predict('bloodPressure', ppgValues);
         if (predictionResult && predictionResult.length >= 2) {
             neuralSystolic = Math.round(predictionResult[0]);
             neuralDiastolic = Math.round(predictionResult[1]);
             console.log(`Neural BP Prediction: ${neuralSystolic}/${neuralDiastolic}`);
         } else {
             console.warn("Neural BP prediction returned invalid result.");
         }
      } else {
         console.warn("TF Worker or BP model not ready for prediction.");
         // Fallback a modelo simulado
         const fallbackModel = getModel('bloodPressure');
         if (fallbackModel) {
             // const bpResult = fallbackModel.predict(preprocessedPpg);
             // neuralSystolic = bpResult[0];
             // neuralDiastolic = bpResult[1];
         }
      }

       // Ejemplo para Glucose
      if (this.tfWorkerClient && this.tfWorkerClient.getModelStatus('glucose') === 'ready') {
        const predictionResult = await this.tfWorkerClient.predict('glucose', ppgValues);
         if (predictionResult && predictionResult.length > 0) {
             neuralGlucose = Math.round(predictionResult[0]);
             console.log("Neural Glucose Prediction:", neuralGlucose);
         } else {
            console.warn("Neural Glucose prediction returned empty or invalid result.");
         }
      } else {
         console.warn("TF Worker or Glucose model not ready for prediction.");
         // Fallback a modelo simulado
         const fallbackModel = getModel('glucose');
         if (fallbackModel) {
            // neuralGlucose = fallbackModel.predict(preprocessedPpg)[0];
         }
      }

    } catch (error) {
      console.error("Error during neural model prediction:", error);
      // Mantener valores de fallback en caso de error
    }

    // Devolver los valores obtenidos (sean de predicción real o fallback)
    return {
      heartRate: neuralHeartRate,
      spo2: neuralSpo2,
      systolic: neuralSystolic,
      diastolic: neuralDiastolic,
      glucose: neuralGlucose,
    };
  }
  
  /**
   * Ponderación especial para SpO2 (más conservadora)
   */
  private weightedSpo2(calibrated: number, neural: number): number {
    // Esta función parece obsoleta si la combinación se hace en processMeasurement
    // Podría ser usada como una estrategia de combinación alternativa.
    console.warn("weightedSpo2 might be deprecated due to new combination logic");
    return (calibrated * 0.7) + (neural * 0.3); // Ejemplo simple
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
    this.lastProcessedData = null; // Limpiar últimos datos procesados
  }
  
  /**
   * Obtiene el estado actual de calibración
   */
  public getCalibrationState(): CalibrationState {
    return this.calibrationSystem.getCalibrationState();
  }
  
  /**
   * Proporciona retroalimentación externa (ej. de un dispositivo médico de referencia)
   */
  public provideExternalReference(type: 'heartRate' | 'spo2' | 'bloodPressure' | 'glucose', value: number | { systolic: number, diastolic: number }): void {
    console.log(`Providing external reference for ${type} via Integrator -> System`);
    this.calibrationSystem.setReferenceValue(type, value);
  }
  
  /**
   * Actualiza la configuración del sistema de calibración
   */
  public updateCalibrationConfig(config: Partial<{
    autoCalibrationEnabled: boolean;
    continuousLearningEnabled: boolean;
    syncWithReferenceDevices: boolean;
    adaptToEnvironment: boolean;
    adaptToUserActivity: boolean;
    aggressiveness: number;
    minimumQualityThreshold: number;
  }>): void {
    console.log("Updating calibration config via Integrator -> System");
    this.calibrationSystem.updateConfig(config);
  }
}
