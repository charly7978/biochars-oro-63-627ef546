
/**
 * Configuration for all processors
 */
export interface ProcessorConfig {
  bufferSize: number;
  sampleRate: number;
  nonInvasiveSettings: {
    glucoseCalibrationFactor: number;
    lipidCalibrationFactor: number;
    hemoglobinCalibrationFactor: number;
    bpCalibrationFactor: number;
    cholesterolCalibrationFactor: number;
    triglycerideCalibrationFactor: number;
    confidenceThreshold: number;
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_PROCESSOR_CONFIG: ProcessorConfig = {
  bufferSize: 300,
  sampleRate: 30,
  nonInvasiveSettings: {
    glucoseCalibrationFactor: 1.0,
    lipidCalibrationFactor: 1.0,
    hemoglobinCalibrationFactor: 1.0,
    bpCalibrationFactor: 1.0,
    cholesterolCalibrationFactor: 1.0,
    triglycerideCalibrationFactor: 1.0,
    confidenceThreshold: 0.5
  }
};
