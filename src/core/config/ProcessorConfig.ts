
/**
 * Configuration interface for all processor components
 */
export interface ProcessorConfig {
  glucoseCalibrationFactor?: number;
  lipidCalibrationFactor?: number;
  hemoglobinCalibrationFactor?: number;
  confidenceThreshold?: number;
  bpCalibrationFactor?: number;
  cholesterolCalibrationFactor?: number;
  triglycerideCalibrationFactor?: number;
  bufferSize?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_PROCESSOR_CONFIG: ProcessorConfig = {
  glucoseCalibrationFactor: 1.0,
  lipidCalibrationFactor: 1.0,
  hemoglobinCalibrationFactor: 1.0,
  confidenceThreshold: 0.6,
  bpCalibrationFactor: 0.85,
  cholesterolCalibrationFactor: 1.0,
  triglycerideCalibrationFactor: 1.0,
  bufferSize: 300
};
