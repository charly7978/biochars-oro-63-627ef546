
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
  }
};
