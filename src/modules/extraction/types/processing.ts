
/**
 * Tipos para el procesamiento avanzado de señales
 */

export interface MLProcessedSignal {
  timestamp: number;
  input: number;
  enhanced: number;
  confidence: number;
  prediction: number[];
  featureImportance?: number[];
  processingTime: number;
  modelVersion?: string;
}

export interface WorkerProcessingResult<T = any> {
  success: boolean;
  data: T;
  processingTime: number;
  error?: string;
}

export interface WorkerTaskConfig {
  timeout?: number;
  priority?: 'high' | 'normal' | 'low';
  processingMode?: 'sync' | 'async' | 'batch';
  useWasm?: boolean;
  useML?: boolean;
}

export enum OptimizationPhase {
  MEMORY_OPTIMIZATION = 'memory_optimization',
  GPU_ACCELERATION = 'gpu_acceleration',
  MODEL_QUANTIZATION = 'model_quantization',
  WORKER_OPTIMIZATION = 'worker_optimization',
  WASM_OPTIMIZATION = 'wasm_optimization',
  CACHE_STRATEGY = 'cache_strategy'
}

export enum OptimizationStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface OptimizationProgress {
  phase: OptimizationPhase;
  status: OptimizationStatus;
  progress: number; // 0-100
  metrics?: {
    before: number;
    after: number;
    unit: string;
  };
}

export interface PerformanceMetrics {
  fps: number;
  processingTime: number;
  memoryUsage: number;
  gpuUsage?: number;
  batteryImpact?: number;
}
