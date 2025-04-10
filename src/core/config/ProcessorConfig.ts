
/**
 * Configuración para procesadores de señal
 */
export interface ProcessorConfig {
  // Parámetros base
  glucoseCalibrationFactor: number;
  lipidCalibrationFactor: number;
  hemoglobinCalibrationFactor: number;
  confidenceThreshold: number;
  
  // Parámetros adicionales
  bpCalibrationFactor: number;
  cholesterolCalibrationFactor: number;
  triglycerideCalibrationFactor: number;
  bufferSize?: number;
}

/**
 * Configuración por defecto
 */
export const DEFAULT_PROCESSOR_CONFIG: ProcessorConfig = {
  glucoseCalibrationFactor: 1.0,
  lipidCalibrationFactor: 1.0,
  hemoglobinCalibrationFactor: 1.0,
  confidenceThreshold: 0.6,
  bpCalibrationFactor: 1.0,
  cholesterolCalibrationFactor: 1.0,
  triglycerideCalibrationFactor: 1.0,
  bufferSize: 300
};
