import { getCalibrationSystem, MeasurementData } from './IntelligentCalibrationSystem';
import { getModel } from '../neural/ModelRegistry';
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
  
  private calibrationSystem = getCalibrationSystem();
  private lastProcessedData: MeasurementData | null = null;
  
  private constructor() {
    // Privado para implementar patrón singleton
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
  public processMeasurement(rawData: {
    ppgValues: number[];
    heartRate: number;
    spo2: number;
    systolic: number;
    diastolic: number;
    glucose: number;
    quality: number;
  }): {
    heartRate: number;
    spo2: number;
    systolic: number;
    diastolic: number;
    glucose: number;
    quality: number;
    isCalibrated: boolean;
  } {
    // Preparar datos de medición
    const measurementData: MeasurementData = {
      timestamp: Date.now(),
      heartRate: rawData.heartRate,
      spo2: rawData.spo2,
      systolic: rawData.systolic,
      diastolic: rawData.diastolic,
      glucose: rawData.glucose,
      quality: rawData.quality,
      rawSignal: rawData.ppgValues
    };
    
    // Procesar con sistema de calibración
    const calibratedData = this.calibrationSystem.processMeasurement(measurementData);
    this.lastProcessedData = measurementData;
    
    let finalHeartRate = Math.round(calibratedData.heartRate);
    let finalSpo2 = Math.round(calibratedData.spo2 * 10) / 10;
    let finalSystolic = Math.round(calibratedData.systolic);
    let finalDiastolic = Math.round(calibratedData.diastolic);
    let finalGlucose = Math.round(calibratedData.glucose);
    
    // Aplicar modelos neuronales si hay suficiente señal de buena calidad
    if (rawData.quality > 75 && rawData.ppgValues && rawData.ppgValues.length > 200) {
      // Usar modelos neuronales para obtener estimaciones independientes
      const neuralEstimates = this.applyNeuralModels(rawData.ppgValues);
      
      // Combinar estimaciones calibradas con las neuronales si están disponibles
      if (neuralEstimates) {
        finalHeartRate = neuralEstimates.heartRate !== null 
          ? Math.round(calibratedData.heartRate * 0.7 + neuralEstimates.heartRate * 0.3)
          : finalHeartRate;
        finalSpo2 = neuralEstimates.spo2 !== null
          ? this.weightedSpo2(calibratedData.spo2, neuralEstimates.spo2)
          : finalSpo2;
        finalSystolic = neuralEstimates.systolic !== null
          ? Math.round(calibratedData.systolic * 0.7 + neuralEstimates.systolic * 0.3)
          : finalSystolic;
        finalDiastolic = neuralEstimates.diastolic !== null
          ? Math.round(calibratedData.diastolic * 0.7 + neuralEstimates.diastolic * 0.3)
          : finalDiastolic;
        finalGlucose = neuralEstimates.glucose !== null
          ? Math.round(calibratedData.glucose * 0.7 + neuralEstimates.glucose * 0.3)
          : finalGlucose;
      }
    }
    
    // Devolver los valores finales
    return {
      heartRate: finalHeartRate,
      spo2: finalSpo2,
      systolic: finalSystolic,
      diastolic: finalDiastolic,
      glucose: finalGlucose,
      quality: calibratedData.quality,
      isCalibrated: this.calibrationSystem.getCalibrationState().phase === 'active'
    };
  }
  
  /**
   * Aplica modelos neuronales para obtener estimaciones independientes
   * Devuelve null para un valor si el modelo falla o no está disponible.
   */
  private applyNeuralModels(ppgValues: number[]): {
    heartRate: number | null;
    spo2: number | null;
    systolic: number | null;
    diastolic: number | null;
    glucose: number | null;
  } | null {
    let heartRate: number | null = null;
    let spo2: number | null = null;
    let systolic: number | null = null;
    let diastolic: number | null = null;
    let glucose: number | null = null;
    let modelsApplied = false;

    try {
      const heartRateModel = getModel<HeartRateNeuralModel>('heartRate');
      if (heartRateModel) {
        heartRate = heartRateModel.predict(ppgValues)[0];
        modelsApplied = true;
      }

      const spo2Model = getModel<SpO2NeuralModel>('spo2');
      if (spo2Model) {
        spo2 = spo2Model.predict(ppgValues)[0];
        modelsApplied = true;
      }

      const bpModel = getModel<BloodPressureNeuralModel>('bloodPressure');
      if (bpModel) {
        const bpResult = bpModel.predict(ppgValues);
        systolic = bpResult[0];
        diastolic = bpResult[1];
        modelsApplied = true;
      }

      const glucoseModel = getModel<GlucoseNeuralModel>('glucose');
      if (glucoseModel) {
        glucose = glucoseModel.predict(ppgValues)[0];
        modelsApplied = true;
      }

      return modelsApplied ? { heartRate, spo2, systolic, diastolic, glucose } : null;

    } catch (error) {
      console.error('Error applying neural models:', error);
      // Devolver estimaciones parciales si alguna tuvo éxito, o null si todas fallaron
      return modelsApplied ? { heartRate, spo2, systolic, diastolic, glucose } : null;
    }
  }
  
  /**
   * Ponderación especial para SpO2 (más conservadora)
   */
  private weightedSpo2(calibrated: number, neural: number): number {
    // SpO2 es más crítico, usar un enfoque más conservador
    // Preferir el valor más alto, ya que valores bajos son más peligrosos si son incorrectos
    const weighted = Math.max(
      calibrated,
      neural * 0.8 + calibrated * 0.2
    );
    return Math.round(weighted * 10) / 10; // 1 decimal
  }
  
  /**
   * Inicia el proceso de calibración
   */
  public startCalibration(): void {
    this.calibrationSystem.startCalibration();
  }
  
  /**
   * Cancela o reinicia la calibración
   */
  public resetCalibration(fullReset: boolean = false): void {
    this.calibrationSystem.resetCalibration(fullReset);
  }
  
  /**
   * Obtiene el estado actual de calibración
   */
  public getCalibrationState() {
    return this.calibrationSystem.getCalibrationState();
  }
  
  /**
   * Proporciona retroalimentación externa (ej. de un dispositivo médico de referencia)
   */
  public provideExternalReference(type: 'heartRate' | 'spo2' | 'bloodPressure' | 'glucose', value: number | { systolic: number, diastolic: number }): void {
    this.calibrationSystem.provideFeedback({
      measurementType: type,
      referenceValue: value
    });
  }
  
  /**
   * Actualiza la configuración del sistema de calibración
   */
  public updateCalibrationConfig(config: {
    autoCalibration?: boolean;
    continuousLearning?: boolean;
    adaptToEnvironment?: boolean;
    adaptToUserActivity?: boolean;
    aggressiveness?: number;
  }): void {
    this.calibrationSystem.updateConfig({
      autoCalibrationEnabled: config.autoCalibration,
      continuousLearningEnabled: config.continuousLearning,
      adaptToEnvironment: config.adaptToEnvironment,
      adaptToUserActivity: config.adaptToUserActivity,
      aggressiveness: config.aggressiveness
    });
  }
}
