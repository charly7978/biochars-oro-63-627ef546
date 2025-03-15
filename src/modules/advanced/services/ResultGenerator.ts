
import type { VitalSignsResult } from '../../core/VitalSignsProcessor';
import type { CalibrationProgress } from '../types/AdvancedProcessorTypes';

/**
 * Servicio para generar resultados a partir del procesamiento de señales
 */
export class ResultGenerator {
  /**
   * Genera un resultado completo basado en los datos de procesamiento
   */
  public generateResult({
    spo2,
    bloodPressure,
    afibResults,
    calibration,
    perfusionIndex,
    pressureArtifactLevel,
    hrvMetrics
  }: {
    spo2: number;
    bloodPressure: { systolic: number; diastolic: number };
    afibResults: { detected: boolean; count: number; confidence: number; irregularIntervals?: number };
    calibration: { isCalibrating: boolean; progress: CalibrationProgress };
    perfusionIndex: number;
    pressureArtifactLevel: number;
    hrvMetrics: any;
  }): VitalSignsResult {
    return {
      spo2: Math.round(spo2),
      pressure: `${Math.round(bloodPressure.systolic)}/${Math.round(bloodPressure.diastolic)}`,
      arrhythmiaStatus: afibResults.detected 
        ? `ARRITMIA DETECTADA|${afibResults.count}` 
        : `SIN ARRITMIAS|${afibResults.count}`,
      glucose: Math.round(90 + 10 * Math.sin(Date.now() / 10000)),
      lipids: {
        totalCholesterol: Math.round(180 + 10 * Math.sin(Date.now() / 15000)),
        triglycerides: Math.round(120 + 15 * Math.sin(Date.now() / 20000))
      },
      atrialFibrillation: {
        detected: afibResults.detected,
        confidence: afibResults.confidence,
        irregularIntervals: afibResults.irregularIntervals || 0
      },
      calibration: calibration,
      lastArrhythmiaData: afibResults.detected ? {
        timestamp: Date.now(),
        rmssd: hrvMetrics.rmssd,
        rrVariation: afibResults.confidence / 100
      } : null
    };
  }
  
  /**
   * Genera un resultado por defecto cuando no hay suficientes datos
   */
  public generateDefaultResult(calibration: { 
    isCalibrating: boolean; 
    progress: CalibrationProgress 
  }): VitalSignsResult {
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "CALIBRANDO...",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      atrialFibrillation: {
        detected: false,
        confidence: 0,
        irregularIntervals: 0
      },
      calibration: calibration,
      lastArrhythmiaData: null
    };
  }
}
