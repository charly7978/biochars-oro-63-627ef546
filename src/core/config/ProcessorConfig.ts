/**
 * Configuración global unificada de la aplicación
 */
export interface AppConfig {
  // Procesamiento de señal
  sampleRate: number;
  bufferSize: number;
  minBPM: number;
  maxBPM: number;
  signalThreshold: number;
  minConfidence: number;
  derivativeThreshold: number;
  minPeakTimeMs: number;
  warmupTimeMs: number;
  medianFilterWindow: number;
  movingAverageWindow: number;
  emaAlpha: number;
  baselineFactor: number;

  // Audio
  beepPrimaryFrequency: number;
  beepSecondaryFrequency: number;
  beepDuration: number;
  beepVolume: number;
  minBeepIntervalMs: number;

  // Calidad de señal
  lowSignalThreshold: number;
  lowSignalFrames: number;

  // Arritmia visualización
  arrhythmiaIndicatorSize: number;
  arrhythmiaPulseColor: string;
  arrhythmiaPulseColorEnd: string;
  arrhythmiaAnimationDurationMs: number;
  arrhythmiaTransitionDurationMs: number;

  // Factores de calibración y análisis
  glucoseCalibrationFactor: number;
  lipidCalibrationFactor: number;
  hemoglobinCalibrationFactor: number;
  hydrationCalibrationFactor: number;
  confidenceThreshold: number;
  bpCalibrationFactor: number;
  cholesterolCalibrationFactor: number;
  triglycerideCalibrationFactor: number;

  // Otros
  lowPowerMode: boolean;
  calibrationEnabled: boolean;
  arrhythmiaDetectionEnabled: boolean;
  resultSmoothingFactor: number;
  minSamplesForAnalysis: number;
  signalThresholds: {
    minRedValue: number;
    maxRedValue: number;
    minAmplitude: number;
    perfusionIndexMin: number;
  };
}

export const APP_CONFIG: AppConfig = {
  sampleRate: 30,
  bufferSize: 300,
  minBPM: 40,
  maxBPM: 200,
  signalThreshold: 0.60,
  minConfidence: 0.50,
  derivativeThreshold: -0.03,
  minPeakTimeMs: 300,
  warmupTimeMs: 2000,
  medianFilterWindow: 3,
  movingAverageWindow: 5,
  emaAlpha: 0.3,
  baselineFactor: 0.995,
  beepPrimaryFrequency: 880,
  beepSecondaryFrequency: 440,
  beepDuration: 80,
  beepVolume: 0.8,
  minBeepIntervalMs: 250,
  lowSignalThreshold: 0.05,
  lowSignalFrames: 10,
  arrhythmiaIndicatorSize: 10,
  arrhythmiaPulseColor: '#FEF7CD',
  arrhythmiaPulseColorEnd: '#F97316',
  arrhythmiaAnimationDurationMs: 800,
  arrhythmiaTransitionDurationMs: 180,
  glucoseCalibrationFactor: 1.0,
  lipidCalibrationFactor: 1.0,
  hemoglobinCalibrationFactor: 1.0,
  hydrationCalibrationFactor: 1.0,
  confidenceThreshold: 0.5,
  bpCalibrationFactor: 1.0,
  cholesterolCalibrationFactor: 1.0,
  triglycerideCalibrationFactor: 1.0,
  lowPowerMode: false,
  calibrationEnabled: true,
  arrhythmiaDetectionEnabled: true,
  resultSmoothingFactor: 0.3,
  minSamplesForAnalysis: 100,
  signalThresholds: {
    minRedValue: 0,
    maxRedValue: 255,
    minAmplitude: 0.05,
    perfusionIndexMin: 0.1
  }
};
