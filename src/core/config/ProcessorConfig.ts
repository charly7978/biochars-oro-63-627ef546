
/**
 * Unified configuration for all processors
 * Centralizes settings and enables dependency injection
 */

export interface ProcessorConfig {
  useWebGPU: boolean;
  bufferSize: number;
  sampleRate: number;
  filterSettings: {
    useLowPass: boolean;
    useHighPass: boolean;
    lowPassCutoff: number;
    highPassCutoff: number;
  };
  neuralNetworks: {
    heartRateModelUrl: string;
    spo2ModelUrl: string;
    bloodPressureModelUrl: string;
    arrhythmiaModelUrl: string;
    glucoseModelUrl: string;
  };
  calibration: {
    requiredSamples: number;
    durationMs: number;
  };
  nonInvasiveSettings: {
    hemoglobinCalibrationFactor: number;
    glucoseCalibrationFactor: number;
    lipidCalibrationFactor: number;
    confidenceThreshold: number;
  };
}

// Default configuration
export const DEFAULT_PROCESSOR_CONFIG: ProcessorConfig = {
  useWebGPU: true,
  bufferSize: 300,
  sampleRate: 30,
  filterSettings: {
    useLowPass: true,
    useHighPass: false,
    lowPassCutoff: 8,
    highPassCutoff: 0.5
  },
  neuralNetworks: {
    heartRateModelUrl: '/models/heart-rate-model/model.json',
    spo2ModelUrl: '/models/spo2-model/model.json',
    bloodPressureModelUrl: '/models/blood-pressure-model/model.json',
    arrhythmiaModelUrl: '/models/arrhythmia-model/model.json',
    glucoseModelUrl: '/models/glucose-model/model.json'
  },
  calibration: {
    requiredSamples: 100,
    durationMs: 10000
  },
  nonInvasiveSettings: {
    hemoglobinCalibrationFactor: 1.0,
    glucoseCalibrationFactor: 1.0,
    lipidCalibrationFactor: 1.0,
    confidenceThreshold: 0.7
  }
};
