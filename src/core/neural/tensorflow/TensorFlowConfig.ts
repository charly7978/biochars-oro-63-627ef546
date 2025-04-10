
/**
 * Configuración y opciones para TensorFlow.js
 * Proporciona ajustes de rendimiento y optimización
 */
export interface TensorFlowConfig {
  // Backend a utilizar (webgl, wasm, cpu)
  backend: 'webgl' | 'wasm' | 'cpu';
  
  // Optimizaciones de memoria
  memoryOptions: {
    // Usar precisión reducida cuando sea posible
    useFloat16: boolean;
    // Activar empaquetado de operaciones cuando sea posible
    enableTensorPacking: boolean;
    // Limitar memoria GPU (0 = sin límite)
    gpuMemoryLimitMB: number;
  };
  
  // Opciones de caché
  cacheOptions: {
    // Activar caché de modelos en IndexedDB
    enableModelCaching: boolean;
    // Prefijo para nombres de modelos en caché
    modelCachePrefix: string;
    // Expiración de caché en días (0 = sin expiración)
    cacheExpirationDays: number;
  };
  
  // Opciones de carga
  loadOptions: {
    // Cargar modelos de manera progresiva (ligeros primero)
    progressiveLoading: boolean;
    // Usar Web Workers cuando sea posible
    useWebWorkers: boolean;
    // Timeout para carga de modelos (ms)
    modelLoadTimeoutMs: number;
    // Intentos máximos de carga
    maxLoadAttempts: number;
  };
  
  // Opciones de autocalibración
  calibrationOptions: {
    // Activar calibración automática
    enableAutoCalibration: boolean;
    // Duración de calibración (ms)
    calibrationDuration: number;
    // Muestras mínimas para calibración
    minCalibrationSamples: number;
    // Factor de corrección máximo
    maxCorrectionFactor: number;
  };
}

/**
 * Configuración por defecto optimizada para rendimiento
 */
export const DEFAULT_TENSORFLOW_CONFIG: TensorFlowConfig = {
  backend: 'webgl',
  memoryOptions: {
    useFloat16: true,
    enableTensorPacking: true,
    gpuMemoryLimitMB: 0,
  },
  cacheOptions: {
    enableModelCaching: true,
    modelCachePrefix: 'vital-signs-model-',
    cacheExpirationDays: 30,
  },
  loadOptions: {
    progressiveLoading: true,
    useWebWorkers: true,
    modelLoadTimeoutMs: 30000,
    maxLoadAttempts: 3
  },
  calibrationOptions: {
    enableAutoCalibration: true,
    calibrationDuration: 8000,
    minCalibrationSamples: 50,
    maxCorrectionFactor: 1.5
  }
};

/**
 * Configuración para dispositivos de baja potencia
 */
export const LOW_POWER_CONFIG: TensorFlowConfig = {
  backend: 'wasm',
  memoryOptions: {
    useFloat16: true,
    enableTensorPacking: true,
    gpuMemoryLimitMB: 50,
  },
  cacheOptions: {
    enableModelCaching: true,
    modelCachePrefix: 'vital-signs-model-lite-',
    cacheExpirationDays: 30,
  },
  loadOptions: {
    progressiveLoading: true,
    useWebWorkers: false,
    modelLoadTimeoutMs: 15000,
    maxLoadAttempts: 2
  },
  calibrationOptions: {
    enableAutoCalibration: true,
    calibrationDuration: 6000,
    minCalibrationSamples: 40,
    maxCorrectionFactor: 1.25
  }
};

/**
 * Configuración para máxima precisión
 */
export const HIGH_ACCURACY_CONFIG: TensorFlowConfig = {
  backend: 'webgl',
  memoryOptions: {
    useFloat16: false,
    enableTensorPacking: true,
    gpuMemoryLimitMB: 0,
  },
  cacheOptions: {
    enableModelCaching: true,
    modelCachePrefix: 'vital-signs-model-hq-',
    cacheExpirationDays: 30,
  },
  loadOptions: {
    progressiveLoading: false,
    useWebWorkers: true,
    modelLoadTimeoutMs: 45000,
    maxLoadAttempts: 4
  },
  calibrationOptions: {
    enableAutoCalibration: true,
    calibrationDuration: 10000,
    minCalibrationSamples: 75,
    maxCorrectionFactor: 1.75
  }
};
