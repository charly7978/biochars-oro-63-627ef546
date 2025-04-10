
/**
 * Configuration options for TensorFlow.js
 */
export interface TensorflowConfig {
  webgl: boolean;
  wasm: boolean;
  cpu: boolean;
  debug: boolean;
  preferredBackend: 'webgl' | 'wasm' | 'cpu';
  modelLoadPath: string;
  modelSavePath: string | null;
  useLocalModels: boolean;
}

/**
 * Default configuration for TensorFlow.js
 */
export const DEFAULT_TENSORFLOW_CONFIG: TensorflowConfig = {
  webgl: true,
  wasm: true,
  cpu: true,
  debug: false,
  preferredBackend: 'webgl',
  modelLoadPath: '/models',
  modelSavePath: null,
  useLocalModels: true
};

/**
 * Detect optimal config based on device capabilities
 */
export function detectOptimalConfig(): TensorflowConfig {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isLowEndDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
  
  if (isMobile || isLowEndDevice) {
    return {
      ...DEFAULT_TENSORFLOW_CONFIG,
      wasm: true,
      webgl: false,
      cpu: true,
      preferredBackend: 'wasm'
    };
  }
  
  return {
    ...DEFAULT_TENSORFLOW_CONFIG,
    webgl: true,
    wasm: false,
    cpu: false,
    preferredBackend: 'webgl'
  };
}

/**
 * Get TensorFlow configuration for specific model type
 */
export function getModelConfig(modelType: string): TensorflowConfig {
  const baseConfig = detectOptimalConfig();
  
  // Customize paths based on model type
  return {
    ...baseConfig,
    modelLoadPath: `/models/${modelType}`
  };
}

/**
 * TensorFlow.js class for centralized configuration
 */
export class TensorFlowConfig {
  private static _instance: TensorFlowConfig;
  private _config: TensorflowConfig;
  
  private constructor() {
    this._config = detectOptimalConfig();
  }
  
  public static getInstance(): TensorFlowConfig {
    if (!TensorFlowConfig._instance) {
      TensorFlowConfig._instance = new TensorFlowConfig();
    }
    return TensorFlowConfig._instance;
  }
  
  public getConfig(): TensorflowConfig {
    return this._config;
  }
  
  public updateConfig(partialConfig: Partial<TensorflowConfig>): void {
    this._config = { ...this._config, ...partialConfig };
  }
  
  public getBackendName(): string {
    return this._config.preferredBackend;
  }
}
