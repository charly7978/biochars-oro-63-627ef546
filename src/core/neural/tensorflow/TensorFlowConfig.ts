
/**
 * TensorFlow configuration for optimized performance
 */

interface OptimizerConfig {
  learningRate: number;
  beta1: number;
  beta2: number;
  epsilon: number;
}

interface TensorflowConfig {
  enablePlatformOptimizations: boolean;
  parallelismLevel: number;
  enableDebugMode: boolean;
  preferWebGPU: boolean;
  enableQuantization: boolean;
  useCustomOps: boolean;
  batchSize: number;
  enablePipelinedExecution: boolean;
  tensorAllocationThreshold: number;
  optimizerConfig: OptimizerConfig;
}

// Base configuration with default values
const BASE_TENSORFLOW_CONFIG: TensorflowConfig = {
  enablePlatformOptimizations: true,
  parallelismLevel: navigator.hardwareConcurrency || 4,
  enableDebugMode: false,
  preferWebGPU: false,
  enableQuantization: false,
  useCustomOps: false,
  batchSize: 32,
  enablePipelinedExecution: true,
  tensorAllocationThreshold: 1024,
  optimizerConfig: {
    learningRate: 0.001,
    beta1: 0.9,
    beta2: 0.999,
    epsilon: 1e-7
  }
};

// Lower-end device configuration (less than 4 cores)
const LOW_END_TENSORFLOW_CONFIG: TensorflowConfig = {
  ...BASE_TENSORFLOW_CONFIG,
  parallelismLevel: 2,
  enablePlatformOptimizations: true,
  enableQuantization: true,
  batchSize: 16,
  enablePipelinedExecution: false,
  tensorAllocationThreshold: 512,
  optimizerConfig: {
    learningRate: 0.001,
    beta1: 0.9,
    beta2: 0.999,
    epsilon: 1e-7
  }
};

// High-end device configuration (8+ cores)
const HIGH_END_TENSORFLOW_CONFIG: TensorflowConfig = {
  ...BASE_TENSORFLOW_CONFIG,
  parallelismLevel: Math.min(navigator.hardwareConcurrency || 8, 16),
  enablePlatformOptimizations: true,
  preferWebGPU: true,
  enableQuantization: false,
  batchSize: 64,
  enablePipelinedExecution: true,
  tensorAllocationThreshold: 2048,
  optimizerConfig: {
    learningRate: 0.001,
    beta1: 0.9,
    beta2: 0.999,
    epsilon: 1e-7
  }
};

// Detect device capability
function detectDeviceCapability(): 'low' | 'medium' | 'high' {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as any).deviceMemory || 4;
  
  if (cores <= 2 || memory <= 2) {
    return 'low';
  } else if (cores >= 8 && memory >= 8) {
    return 'high';
  } else {
    return 'medium';
  }
}

// Select appropriate configuration based on device capability
function selectTensorFlowConfig(): TensorflowConfig {
  const capability = detectDeviceCapability();
  
  switch (capability) {
    case 'low':
      return LOW_END_TENSORFLOW_CONFIG;
    case 'high':
      return HIGH_END_TENSORFLOW_CONFIG;
    default:
      return BASE_TENSORFLOW_CONFIG;
  }
}

// Optimized configuration based on device capabilities
export const OPTIMIZED_TENSORFLOW_CONFIG: TensorflowConfig = selectTensorFlowConfig();
