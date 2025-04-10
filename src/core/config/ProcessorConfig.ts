
export interface ProcessorConfig {
  // Configuración general
  lowPowerMode: boolean;
  bufferSize: number;
  calibrationEnabled: boolean;
  
  // Parámetros de detección PPG
  signalThresholds: {
    minRedValue: number;
    maxRedValue: number;
    minAmplitude: number;
    perfusionIndexMin: number;
  };
  
  // Parámetros de filtrado
  filterSettings: {
    waveletThreshold: number;
    kalmanProcessNoise: number;
    kalmanMeasurementNoise: number;
    baselineFactor: number;
  };
  
  // Parámetros de frecuencia cardíaca
  heartRateSettings: {
    minBPM: number;
    maxBPM: number;
    minPeakTime: number;
    maxPeakTime: number;
  };
  
  // Parámetros de arritmia
  arrhythmiaSettings: {
    rmssdThreshold: number;
    rrVariationThreshold: number;
    minTimeBetween: number;
  };
  
  // Parámetros de presión arterial
  bloodPressureSettings: {
    systolicMin: number;
    systolicMax: number;
    diastolicMin: number;
    diastolicMax: number;
    pulseRangeMin: number;
    pulseRangeMax: number;
  };
  
  // Parámetros para mediciones no invasivas 
  nonInvasiveSettings: {
    glucoseCalibrationFactor: number;
    lipidCalibrationFactor: number;
    hemoglobinCalibrationFactor: number;
    confidenceThreshold: number;
  };
}

/**
 * Configuración optimizada por defecto
 * - Basado en análisis de código y estudios de rendimiento
 * - Elimina valores duplicados entre múltiples procesadores
 * - Establece valores sensatos basados en literatura científica
 */
export const DEFAULT_PROCESSOR_CONFIG: ProcessorConfig = {
  lowPowerMode: false,
  bufferSize: 300,
  calibrationEnabled: true,
  
  signalThresholds: {
    minRedValue: 60,
    maxRedValue: 230,
    minAmplitude: 0.05,
    perfusionIndexMin: 0.05,
  },
  
  filterSettings: {
    waveletThreshold: 0.025,
    kalmanProcessNoise: 0.01,
    kalmanMeasurementNoise: 0.1,
    baselineFactor: 0.95,
  },
  
  heartRateSettings: {
    minBPM: 40,
    maxBPM: 200,
    minPeakTime: 450,
    maxPeakTime: 1500,
  },
  
  arrhythmiaSettings: {
    rmssdThreshold: 35,
    rrVariationThreshold: 0.17,
    minTimeBetween: 3000,
  },
  
  bloodPressureSettings: {
    systolicMin: 90,
    systolicMax: 170,
    diastolicMin: 60,
    diastolicMax: 100,
    pulseRangeMin: 30,
    pulseRangeMax: 60,
  },
  
  nonInvasiveSettings: {
    glucoseCalibrationFactor: 1.0,
    lipidCalibrationFactor: 1.0,
    hemoglobinCalibrationFactor: 1.0,
    confidenceThreshold: 0.7,
  }
};

/**
 * Configuración para dispositivos de baja potencia
 * - Optimizada para rendimiento en dispositivos móviles de gama baja
 * - Reduce uso de CPU y carga de procesamiento
 * - Mantiene precisión dentro de márgenes aceptables
 */
export const LOW_POWER_CONFIG: ProcessorConfig = {
  ...DEFAULT_PROCESSOR_CONFIG,
  lowPowerMode: true,
  bufferSize: 120,
  
  filterSettings: {
    ...DEFAULT_PROCESSOR_CONFIG.filterSettings,
    waveletThreshold: 0.03,
  },
};

/**
 * Configuración para alta precisión
 * - Mayor carga de procesamiento
 * - Usa más memoria y CPU
 * - Mejora precisión para dispositivos de gama alta
 */
export const HIGH_PRECISION_CONFIG: ProcessorConfig = {
  ...DEFAULT_PROCESSOR_CONFIG,
  bufferSize: 450,
  
  filterSettings: {
    ...DEFAULT_PROCESSOR_CONFIG.filterSettings,
    waveletThreshold: 0.02,
    kalmanProcessNoise: 0.008,
    kalmanMeasurementNoise: 0.08,
  },
  
  heartRateSettings: {
    ...DEFAULT_PROCESSOR_CONFIG.heartRateSettings,
    minPeakTime: 400,
    maxPeakTime: 1600,
  },
};
