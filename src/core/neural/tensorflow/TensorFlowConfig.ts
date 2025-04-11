
/**
 * Configuración y opciones para TensorFlow.js
 * Proporciona ajustes de rendimiento y optimización
 */
export interface TensorFlowConfig {
  // Backend a utilizar (webgl, wasm, cpu)
  backend: 'webgl' | 'wasm' | 'cpu' | 'webgpu';
  
  // Optimizaciones de memoria
  memoryOptions: {
    // Usar precisión reducida cuando sea posible
    useFloat16: boolean;
    // Activar empaquetado de operaciones cuando sea posible
    enableTensorPacking: boolean;
    // Limitar memoria GPU (0 = sin límite)
    gpuMemoryLimitMB: number;
    // Activar limpieza automática de tensores
    enableAutoGarbageCollection: boolean;
  };
  
  // Opciones de caché
  cacheOptions: {
    // Activar caché de modelos en IndexedDB
    enableModelCaching: boolean;
    // Prefijo para nombres de modelos en caché
    modelCachePrefix: string;
    // Expiración de caché en días (0 = sin expiración)
    cacheExpirationDays: number;
    // Versión de caché para control de actualizaciones
    cacheVersion: string;
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
    // Prioridad de modelos (1-10, 10 es máxima)
    modelPriority: number;
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
    // Intervalo de recalibración automática (ms, 0 = desactivado)
    autoRecalibrationIntervalMs: number;
  };
  
  // Opciones avanzadas para WebGL/WebGPU
  advancedOptions: {
    // Activar optimizaciones específicas de plataforma
    enablePlatformOptimizations: boolean;
    // Nivel de paralelismo (0 = automático)
    parallelismLevel: number;
    // Activar depuración de operaciones
    enableDebugMode: boolean;
    // Activar WebGPU cuando disponible (experimental)
    preferWebGPU: boolean;
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
    enableAutoGarbageCollection: true
  },
  cacheOptions: {
    enableModelCaching: true,
    modelCachePrefix: 'vital-signs-model-',
    cacheExpirationDays: 30,
    cacheVersion: '1.0.0'
  },
  loadOptions: {
    progressiveLoading: true,
    useWebWorkers: true,
    modelLoadTimeoutMs: 30000,
    maxLoadAttempts: 3,
    modelPriority: 5
  },
  calibrationOptions: {
    enableAutoCalibration: true,
    calibrationDuration: 8000,
    minCalibrationSamples: 50,
    maxCorrectionFactor: 1.5,
    autoRecalibrationIntervalMs: 0
  },
  advancedOptions: {
    enablePlatformOptimizations: true,
    parallelismLevel: 0,
    enableDebugMode: false,
    preferWebGPU: false
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
    enableAutoGarbageCollection: true
  },
  cacheOptions: {
    enableModelCaching: true,
    modelCachePrefix: 'vital-signs-model-lite-',
    cacheExpirationDays: 30,
    cacheVersion: '1.0.0'
  },
  loadOptions: {
    progressiveLoading: true,
    useWebWorkers: false,
    modelLoadTimeoutMs: 15000,
    maxLoadAttempts: 2,
    modelPriority: 3
  },
  calibrationOptions: {
    enableAutoCalibration: true,
    calibrationDuration: 6000,
    minCalibrationSamples: 40,
    maxCorrectionFactor: 1.25,
    autoRecalibrationIntervalMs: 0
  },
  advancedOptions: {
    enablePlatformOptimizations: true,
    parallelismLevel: 1,
    enableDebugMode: false,
    preferWebGPU: false
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
    enableAutoGarbageCollection: true
  },
  cacheOptions: {
    enableModelCaching: true,
    modelCachePrefix: 'vital-signs-model-hq-',
    cacheExpirationDays: 30,
    cacheVersion: '1.0.0'
  },
  loadOptions: {
    progressiveLoading: false,
    useWebWorkers: true,
    modelLoadTimeoutMs: 45000,
    maxLoadAttempts: 4,
    modelPriority: 8
  },
  calibrationOptions: {
    enableAutoCalibration: true,
    calibrationDuration: 10000,
    minCalibrationSamples: 75,
    maxCorrectionFactor: 1.75,
    autoRecalibrationIntervalMs: 0
  },
  advancedOptions: {
    enablePlatformOptimizations: true,
    parallelismLevel: 0,
    enableDebugMode: false,
    preferWebGPU: true
  }
};

/**
 * Detecta automáticamente la mejor configuración según el dispositivo
 */
export const detectOptimalConfig = (): TensorFlowConfig => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isLowEndDevice = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : true;
  
  // Use safer memory detection
  const hasGoodMemory = typeof (navigator as any).deviceMemory !== 'undefined' ? 
    (navigator as any).deviceMemory >= 4 : false;
  
  if (isMobile && isLowEndDevice) {
    return LOW_POWER_CONFIG;
  } else if (!isMobile && !isLowEndDevice && hasGoodMemory) {
    return HIGH_ACCURACY_CONFIG;
  } else {
    return DEFAULT_TENSORFLOW_CONFIG;
  }
};
