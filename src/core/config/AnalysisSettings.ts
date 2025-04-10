
/**
 * Settings for signal analysis and estimation algorithms
 */
export interface AnalysisSettings {
  // Calibration factors
  glucoseCalibrationFactor?: number;
  lipidCalibrationFactor?: number;
  hemoglobinCalibrationFactor?: number;
  hydrationCalibrationFactor?: number;
  confidenceThreshold?: number;
  bpCalibrationFactor?: number;
  cholesterolCalibrationFactor?: number;
  triglycerideCalibrationFactor?: number;
  
  // Buffer settings
  bufferSize?: number;
}

/**
 * Default analysis settings
 */
export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  glucoseCalibrationFactor: 1.0,
  lipidCalibrationFactor: 1.0,
  hemoglobinCalibrationFactor: 1.0,
  hydrationCalibrationFactor: 1.0,
  confidenceThreshold: 0.5,
  bpCalibrationFactor: 1.0,
  cholesterolCalibrationFactor: 1.0,
  triglycerideCalibrationFactor: 1.0,
  bufferSize: 10
};
