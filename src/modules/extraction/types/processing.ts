
/**
 * Tipos de datos para procesamiento de señales
 */

export interface ProcessingError {
  code: string;
  message: string;
  timestamp: number;
}

export interface MLProcessedSignal {
  timestamp: number;
  input: number;
  enhanced: number;
  confidence: number;
  prediction: number[];
  processingTime: number;
  modelVersion: string;
  quality?: number;
}

export interface WorkerProcessingResult {
  success: boolean;
  error?: string;
  data: {
    processed?: number;
    filtered?: number[];
    peaks?: number[];
    stats?: {
      mean: number;
      variance: number;
      min: number;
      max: number;
    };
  };
}

export enum OptimizationPhase {
  INITIALIZATION = 'initialization',
  WASM_COMPILATION = 'wasm_compilation',
  MODEL_LOADING = 'model_loading',
  WORKER_SETUP = 'worker_setup',
  CACHE_SETUP = 'cache_setup',
  READY = 'ready'
}

export interface OptimizationStatus {
  completed: boolean;
  progress: number;
  error?: string;
  details?: string;
}

export interface OptimizationMetrics {
  processingTime: number;
  memoryUsage: number;
  cpuUsage: number;
  frameRate: number;
}

export interface OptimizationSummary {
  isFullyOptimized: boolean;
  wasmAvailable: boolean;
  webglAvailable: boolean;
  workerCount: number;
  modelLoaded: boolean;
  averageProcessingTime: number;
}
