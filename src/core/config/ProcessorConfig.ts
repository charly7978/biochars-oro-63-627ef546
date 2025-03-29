
export interface ProcessorConfig {
  nonInvasiveSettings: {
    // Blood pressure calibration
    bpCalibrationFactor: number;
    
    // Glucose calibration
    glucoseCalibrationFactor: number;
    
    // Lipid calibration
    lipidCalibrationFactor: number;
    cholesterolCalibrationFactor: number;
    triglycerideCalibrationFactor: number;
    
    // Hemoglobin calibration
    hemoglobinCalibrationFactor: number;
    
    // General settings
    confidenceThreshold: number;
  };
}

export const DEFAULT_PROCESSOR_CONFIG: ProcessorConfig = {
  nonInvasiveSettings: {
    bpCalibrationFactor: 1.0,
    glucoseCalibrationFactor: 1.0,
    lipidCalibrationFactor: 1.0,
    cholesterolCalibrationFactor: 1.0,
    triglycerideCalibrationFactor: 1.0,
    hemoglobinCalibrationFactor: 1.0,
    confidenceThreshold: 0.7
  }
};
