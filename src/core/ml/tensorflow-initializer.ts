
import * as tf from '@tensorflow/tfjs';
import { container } from '../di/service-container';
import { TensorFlowService } from './tensorflow-service';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../config/ProcessorConfig';

/**
 * Initialize TensorFlow.js and register services in the container
 */
export async function initializeTensorFlow(config: Partial<ProcessorConfig> = {}): Promise<boolean> {
  try {
    console.log('Initializing TensorFlow.js services...');
    
    // Merge config with defaults
    const fullConfig = {
      ...DEFAULT_PROCESSOR_CONFIG,
      ...config
    };
    
    // Create TensorFlow service
    const tfService = new TensorFlowService(fullConfig);
    await tfService.initialize();
    
    // Register in container
    container.register('tensorflowService', tfService);
    
    console.log('TensorFlow.js initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize TensorFlow.js:', error);
    return false;
  }
}

/**
 * Load all neural network models
 */
export async function preloadModels(): Promise<boolean> {
  try {
    const tfService = container.get<TensorFlowService>('tensorflowService');
    const config = container.get<ProcessorConfig>('processorConfig');
    
    // Load models in parallel
    const modelPromises = [
      tfService.loadModel('heartRate', config.neuralNetworks.heartRateModelUrl),
      tfService.loadModel('spo2', config.neuralNetworks.spo2ModelUrl),
      tfService.loadModel('bloodPressure', config.neuralNetworks.bloodPressureModelUrl),
      tfService.loadModel('arrhythmia', config.neuralNetworks.arrhythmiaModelUrl),
      tfService.loadModel('glucose', config.neuralNetworks.glucoseModelUrl)
    ];
    
    await Promise.all(modelPromises);
    
    console.log('All neural network models loaded successfully');
    return true;
  } catch (error) {
    console.error('Failed to preload models:', error);
    return false;
  }
}

/**
 * Get TensorFlow.js backend information
 */
export function getTensorFlowInfo(): {
  version: string;
  backend: string;
  device: string;
  isWebGPU: boolean;
} {
  const backend = tf.getBackend() || 'none';
  const isWebGPU = backend === 'webgpu';
  
  // Get device info without accessing private properties
  let device = 'Unknown';
  if (isWebGPU) {
    device = 'WebGPU';
  } else if (backend === 'webgl') {
    device = 'WebGL';
  } else if (backend === 'cpu') {
    device = 'CPU';
  }
  
  return {
    version: tf.version.tfjs,
    backend,
    device,
    isWebGPU
  };
}
