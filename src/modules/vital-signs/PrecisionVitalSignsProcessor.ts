
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Procesador de signos vitales de alta precisión
 * Implementa calibración, validación cruzada y ajustes ambientales
 */

import { ProcessedSignal, VitalSignType } from '../../types/signal';
import { CalibrationManager, CalibrationReference } from './calibration/CalibrationManager';
import { CrossValidator, MeasurementsToValidate } from './correlation/CrossValidator';
import { EnvironmentalAdjuster } from './environment/EnvironmentalAdjuster';
import { ModularVitalSignsProcessor, VitalSignsResult } from './ModularVitalSignsProcessor';

/**
 * Resultado de medición con precisión mejorada
 */
export interface PrecisionVitalSignsResult extends VitalSignsResult {
  isCalibrated: boolean;
  correlationValidated: boolean;
  environmentallyAdjusted: boolean;
  precisionMetrics: {
    calibrationConfidence: number;
    correlationConfidence: number;
    environmentalConfidence: number;
    overallPrecision: number;
  };
}

/**
 * Procesador de signos vitales con precisión mejorada
 * Utiliza calibración, validación cruzada y ajustes ambientales
 */
export class PrecisionVitalSignsProcessor {
  private baseProcessor: ModularVitalSignsProcessor;
  private calibrationManager: CalibrationManager;
  private crossValidator: CrossValidator;
  private environmentalAdjuster: EnvironmentalAdjuster;
  
  // Almacenamiento de señal reciente
  private recentSignals: ProcessedSignal[] = [];
  private readonly MAX_RECENT_SIGNALS = 50;
  
  // Estado de procesamiento
  private isProcessing: boolean = false;
  private lastResult: PrecisionVitalSignsResult | null = null;
  
  /**
   * Constructor
   */
  constructor() {
    // Inicializar procesador base y sistemas de mejora
    this.baseProcessor = new ModularVitalSignsProcessor();
    this.calibrationManager = CalibrationManager.getInstance();
    this.crossValidator = CrossValidator.getInstance();
    this.environmentalAdjuster = EnvironmentalAdjuster.getInstance();
    
    console.log("PrecisionVitalSignsProcessor: Inicializado con sistemas de precisión mejorada");
  }
  
  /**
   * Iniciar procesamiento
   */
  public start(): void {
    if (this.isProcessing) return;
    
    // Iniciar procesador base
    this.baseProcessor.start();
    
    this.isProcessing = true;
    console.log("PrecisionVitalSignsProcessor: Iniciado");
  }
  
  /**
   * Detener procesamiento
   */
  public stop(): void {
    if (!this.isProcessing) return;
    
    // Detener procesador base
    this.baseProcessor.stop();
    
    this.isProcessing = false;
    console.log("PrecisionVitalSignsProcessor: Detenido");
  }
  
  /**
   * Restablecer todos los subsistemas
   */
  public reset(): void {
    // Restablecer procesador base
    this.baseProcessor.reset();
    
    // Reiniciar sistemas de precisión
    this.environmentalAdjuster.reset();
    
    // No reiniciamos calibración para mantener datos de referencia
    
    // Limpiar señales recientes
    this.recentSignals = [];
    this.lastResult = null;
    
    console.log("PrecisionVitalSignsProcessor: Restablecido");
  }
  
  /**
   * Agregar datos de referencia para calibración
   * @param reference Datos de referencia médicos
   * @returns Éxito de la operación
   */
  public addCalibrationReference(reference: CalibrationReference): boolean {
    return this.calibrationManager.addReferenceData(reference);
  }
  
  /**
   * Actualizar condiciones ambientales
   * @param conditions Condiciones ambientales
   */
  public updateEnvironmentalConditions(conditions: any): void {
    this.environmentalAdjuster.updateConditions(conditions);
  }
  
  /**
   * Procesar señal con mejoras de precisión
   * @param signal Señal procesada PPG
   * @returns Resultado de signos vitales mejorado
   */
  public processSignal(signal: ProcessedSignal): PrecisionVitalSignsResult {
    if (!this.isProcessing) {
      console.log("PrecisionVitalSignsProcessor: No está procesando");
      return this.createEmptyResult();
    }
    
    try {
      // 1. Almacenar señal para análisis
      this.recentSignals.push(signal);
      if (this.recentSignals.length > this.MAX_RECENT_SIGNALS) {
        this.recentSignals.shift();
      }
      
      // 2. Estimar condiciones ambientales automáticamente
      if (this.recentSignals.length >= 20) {
        const recentValues = this.recentSignals.slice(-20).map(s => s.filteredValue);
        this.environmentalAdjuster.estimateConditions(recentValues);
      }
      
      // 3. Aplicar ajustes ambientales a la señal
      const environmentalConfidence = this.environmentalAdjuster.getAdjustmentFactors().confidence;
      const adjustedSignal = { ...signal };
      adjustedSignal.filteredValue = this.environmentalAdjuster.applySignalAdjustment(signal.filteredValue);
      
      // 4. Procesar señal ajustada con el procesador base
      const baseResult = this.baseProcessor.processSignal(adjustedSignal);
      
      // 5. Convertir a formato para validación cruzada
      const measurements: MeasurementsToValidate = {
        spo2: baseResult.spo2,
        systolic: baseResult.bloodPressure.systolic,
        diastolic: baseResult.bloodPressure.diastolic,
        heartRate: baseResult.cardiac.heartRate,
        glucose: baseResult.glucose,
        cholesterol: baseResult.lipids.totalCholesterol,
        triglycerides: baseResult.lipids.triglycerides
      };
      
      // 6. Realizar validación cruzada
      const validationResult = this.crossValidator.validateMeasurements(measurements);
      
      // 7. Aplicar ajustes de la validación si es necesario
      let adjustedMeasurements = measurements;
      let correlationConfidence = 1.0;
      
      if (!validationResult.isValid) {
        // Aplicar correcciones de la validación
        adjustedMeasurements = this.crossValidator.applyAdjustments(measurements, validationResult);
        correlationConfidence = validationResult.confidence;
      }
      
      // 8. Aplicar calibración individual a cada valor
      const calibrationConfidence = this.calibrationManager.getCalibrationConfidence();
      let calibratedValues = { ...adjustedMeasurements };
      
      if (this.calibrationManager.isSystemCalibrated()) {
        calibratedValues.spo2 = this.calibrationManager.applyCalibration(VitalSignType.SPO2, adjustedMeasurements.spo2 || 0);
        calibratedValues.glucose = this.calibrationManager.applyCalibration(VitalSignType.GLUCOSE, adjustedMeasurements.glucose || 0);
        calibratedValues.cholesterol = this.calibrationManager.applyCalibration(VitalSignType.LIPIDS, adjustedMeasurements.cholesterol || 0);
        calibratedValues.triglycerides = this.calibrationManager.applyCalibration(VitalSignType.LIPIDS, adjustedMeasurements.triglycerides || 0);
        
        if (adjustedMeasurements.systolic && adjustedMeasurements.diastolic) {
          calibratedValues.systolic = this.calibrationManager.applyCalibration(VitalSignType.BLOOD_PRESSURE, adjustedMeasurements.systolic);
          calibratedValues.diastolic = this.calibrationManager.applyCalibration(VitalSignType.BLOOD_PRESSURE, adjustedMeasurements.diastolic);
        }
        
        if (adjustedMeasurements.heartRate) {
          calibratedValues.heartRate = this.calibrationManager.applyCalibration(VitalSignType.CARDIAC, adjustedMeasurements.heartRate);
        }
      }
      
      // 9. Calcular precisión general
      const overallPrecision = (
        calibrationConfidence * 0.4 + 
        correlationConfidence * 0.3 + 
        environmentalConfidence * 0.3
      );
      
      // 10. Crear resultado final con todos los ajustes aplicados
      const result: PrecisionVitalSignsResult = {
        ...baseResult,
        
        // Reemplazar valores con los ajustados
        spo2: Math.round(calibratedValues.spo2 || baseResult.spo2),
        glucose: Math.round(calibratedValues.glucose || baseResult.glucose),
        lipids: {
          totalCholesterol: Math.round(calibratedValues.cholesterol || baseResult.lipids.totalCholesterol),
          triglycerides: Math.round(calibratedValues.triglycerides || baseResult.lipids.triglycerides)
        },
        bloodPressure: {
          systolic: Math.round(calibratedValues.systolic || baseResult.bloodPressure.systolic),
          diastolic: Math.round(calibratedValues.diastolic || baseResult.bloodPressure.diastolic)
        },
        cardiac: {
          ...baseResult.cardiac,
          heartRate: Math.round(calibratedValues.heartRate || baseResult.cardiac.heartRate)
        },
        
        // Agregar información de precisión
        isCalibrated: this.calibrationManager.isSystemCalibrated(),
        correlationValidated: validationResult.isValid,
        environmentallyAdjusted: true,
        precisionMetrics: {
          calibrationConfidence,
          correlationConfidence,
          environmentalConfidence,
          overallPrecision
        }
      };
      
      // Guardar y devolver resultado
      this.lastResult = result;
      
      console.log("PrecisionVitalSignsProcessor: Resultado procesado con precisión mejorada", {
        spo2: result.spo2,
        bloodPressure: `${result.bloodPressure.systolic}/${result.bloodPressure.diastolic}`,
        heartRate: result.cardiac.heartRate,
        calibrated: result.isCalibrated,
        precision: result.precisionMetrics.overallPrecision.toFixed(2)
      });
      
      return result;
    } catch (error) {
      console.error("PrecisionVitalSignsProcessor: Error procesando señal", error);
      return this.createEmptyResult();
    }
  }
  
  /**
   * Crear resultado vacío para cuando no hay procesamiento válido
   */
  private createEmptyResult(): PrecisionVitalSignsResult {
    const baseEmpty = {
      ...this.baseProcessor.processSignal({
        timestamp: Date.now(),
        rawValue: 0,
        filteredValue: 0,
        quality: 0,
        fingerDetected: false,
        perfusionIndex: 0,
        roi: { x: 0, y: 0, width: 0, height: 0 }
      })
    };
    
    return {
      ...baseEmpty,
      isCalibrated: this.calibrationManager.isSystemCalibrated(),
      correlationValidated: false,
      environmentallyAdjusted: false,
      precisionMetrics: {
        calibrationConfidence: this.calibrationManager.getCalibrationConfidence(),
        correlationConfidence: 0,
        environmentalConfidence: this.environmentalAdjuster.getAdjustmentFactors().confidence,
        overallPrecision: 0
      }
    };
  }
  
  /**
   * Verificar si el sistema está calibrado
   */
  public isCalibrated(): boolean {
    return this.calibrationManager.isSystemCalibrated();
  }
  
  /**
   * Obtener resultado más reciente
   */
  public getLastResult(): PrecisionVitalSignsResult | null {
    return this.lastResult;
  }
  
  /**
   * Obtener métricas de diagnóstico
   */
  public getDiagnostics(): any {
    return {
      isProcessing: this.isProcessing,
      signalCount: this.recentSignals.length,
      isCalibrated: this.calibrationManager.isSystemCalibrated(),
      calibrationFactors: this.calibrationManager.getCalibrationFactors(),
      environmentalConditions: this.environmentalAdjuster.getCurrentConditions(),
      adjustmentFactors: this.environmentalAdjuster.getAdjustmentFactors(),
      baseProcessorDiagnostics: this.baseProcessor.getDiagnostics()
    };
  }
}
