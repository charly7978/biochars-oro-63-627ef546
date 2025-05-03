
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
    
    // Aplicar modelos neuronales si hay suficiente señal de buena calidad
    if (rawData.quality > 75 && rawData.ppgValues && rawData.ppgValues.length > 200) {
      // Usar modelos neuronales para obtener estimaciones independientes
      const neuralEstimates = this.applyNeuralModels(rawData.ppgValues);
      
      // Combinar estimaciones calibradas con las neurales (70/30)
      return {
        heartRate: Math.round(calibratedData.heartRate * 0.7 + neuralEstimates.heartRate * 0.3),
        spo2: this.weightedSpo2(calibratedData.spo2, neuralEstimates.spo2),
        systolic: Math.round(calibratedData.systolic * 0.7 + neuralEstimates.systolic * 0.3),
        diastolic: Math.round(calibratedData.diastolic * 0.7 + neuralEstimates.diastolic * 0.3),
        glucose: Math.round(calibratedData.glucose * 0.7 + neuralEstimates.glucose * 0.3),
        quality: calibratedData.quality,
        isCalibrated: this.calibrationSystem.getCalibrationState().phase === 'active'
      };
    }
    
    // Si no hay señal de buena calidad, usar solo los datos calibrados
    return {
      heartRate: Math.round(calibratedData.heartRate),
      spo2: Math.round(calibratedData.spo2 * 10) / 10, // 1 decimal para SpO2
      systolic: Math.round(calibratedData.systolic),
      diastolic: Math.round(calibratedData.diastolic),
      glucose: Math.round(calibratedData.glucose),
      quality: calibratedData.quality,
      isCalibrated: this.calibrationSystem.getCalibrationState().phase === 'active'
    };
  }
  
  /**
   * Aplica modelos neuronales para obtener estimaciones independientes
   */
  private applyNeuralModels(ppgValues: number[]): {
    heartRate: number;
    spo2: number;
    systolic: number;
    diastolic: number;
    glucose: number;
  } {
    // Valores por defecto
    const defaultEstimates = {
      heartRate: 75,
      spo2: 97,
      systolic: 120,
      diastolic: 80,
      glucose: 95
    };
    
    try {
      // Obtener estimaciones de cada modelo
      const heartRateModel = getModel<HeartRateNeuralModel>('heartRate');
      const spo2Model = getModel<SpO2NeuralModel>('spo2');
      const bpModel = getModel<BloodPressureNeuralModel>('bloodPressure');
      const glucoseModel = getModel<GlucoseNeuralModel>('glucose');
      
      // Aplicar modelos que estén disponibles
      const heartRate = heartRateModel ? heartRateModel.predict(ppgValues)[0] : defaultEstimates.heartRate;
      const spo2 = spo2Model ? spo2Model.predict(ppgValues)[0] : defaultEstimates.spo2;
      
      let systolic = defaultEstimates.systolic;
      let diastolic = defaultEstimates.diastolic;
      if (bpModel) {
        const bpResult = bpModel.predict(ppgValues);
        systolic = bpResult[0];
        diastolic = bpResult[1];
      }
      
      const glucose = glucoseModel ? glucoseModel.predict(ppgValues)[0] : defaultEstimates.glucose;
      
      return { heartRate, spo2, systolic, diastolic, glucose };
    } catch (error) {
      console.error('Error al aplicar modelos neuronales:', error);
      return defaultEstimates;
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
