
import { AnalysisSettings, DEFAULT_ANALYSIS_SETTINGS } from './AnalysisSettings';

/**
 * Unified configuration for the core signal processor
 */
export interface ProcessorConfig {
  // General settings
  lowPowerMode: boolean;
  bufferSize: number;
  
  // Calibration settings
  calibrationEnabled: boolean;
  
  // Signal thresholds
  signalThresholds: {
    minRedValue: number;
    maxRedValue: number;
    minAmplitude: number;
    perfusionIndexMin: number;
  };
  
  // Sample rate settings
  sampleRate: number;
  minSamplesForAnalysis: number;
  
  // Detection settings
  arrhythmiaDetectionEnabled: boolean;
  
  // Results settings
  resultSmoothingFactor: number;
  
  // Analysis settings
  analysisSettings: AnalysisSettings;
}

/**
 * Default processor configuration
 */
export const DEFAULT_PROCESSOR_CONFIG: ProcessorConfig = {
  lowPowerMode: false,
  bufferSize: 300,
  
  calibrationEnabled: true,
  
  signalThresholds: {
    minRedValue: 0,
    maxRedValue: 255,
    minAmplitude: 0.05,
    perfusionIndexMin: 0.1
  },
  
  sampleRate: 30,
  minSamplesForAnalysis: 100,
  
  arrhythmiaDetectionEnabled: true,
  
  resultSmoothingFactor: 0.3,
  
  analysisSettings: DEFAULT_ANALYSIS_SETTINGS
};
