
import * as tf from '@tensorflow/tfjs';
import { ProcessorConfig } from '../config/ProcessorConfig';

/**
 * TensorFlow.js service for neural network processing
 * Provides unified interface for all ML operations with WebGPU acceleration
 */
export class TensorFlowService {
  private modelCache: Map<string, tf.LayersModel> = new Map();
  private isInitialized: boolean = false;
  private useWebGPU: boolean = false;
  private config: ProcessorConfig;

  constructor(config: ProcessorConfig) {
    this.config = config;
  }

  /**
   * Initialize TensorFlow.js with WebGPU if available
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      console.log('TensorFlow.js initializing...');
      
      // Check if WebGPU is available
      if (this.config.useWebGPU && await this.isWebGPUAvailable()) {
        await tf.setBackend('webgpu');
        this.useWebGPU = true;
        console.log('TensorFlow.js using WebGPU acceleration');
      } else {
        await tf.setBackend('webgl');
        console.log('TensorFlow.js using WebGL fallback');
      }
      
      await tf.ready();
      this.isInitialized = true;
      
      console.log(`TensorFlow.js initialized. Version: ${tf.version.tfjs}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize TensorFlow.js:', error);
      return false;
    }
  }

  /**
   * Check if WebGPU is available in the current browser
   */
  private async isWebGPUAvailable(): Promise<boolean> {
    try {
      // Check if WebGPU is supported in the browser
      if (!navigator.gpu) {
        return false;
      }
      
      // Try to request adapter to confirm availability
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch (error) {
      console.warn('WebGPU check failed:', error);
      return false;
    }
  }

  /**
   * Load a model from URL or use cached version
   */
  public async loadModel(modelKey: string, modelUrl: string): Promise<tf.LayersModel | null> {
    try {
      if (this.modelCache.has(modelKey)) {
        return this.modelCache.get(modelKey)!;
      }

      const model = await tf.loadLayersModel(modelUrl);
      this.modelCache.set(modelKey, model);
      return model;
    } catch (error) {
      console.error(`Failed to load model ${modelKey}:`, error);
      return null;
    }
  }

  /**
   * Process signal data through neural network
   */
  public async processSignal(
    signalData: number[], 
    modelKey: string, 
    inputShape: number[] = [1, signalData.length]
  ): Promise<Float32Array | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      const model = this.modelCache.get(modelKey);
      if (!model) {
        throw new Error(`Model ${modelKey} not loaded`);
      }

      // Convert data to tensor
      const tensor = tf.tensor(signalData, inputShape);
      
      // Run inference
      const result = model.predict(tensor) as tf.Tensor;
      
      // Get results and clean up tensors
      const resultData = await result.data();
      
      // Create a new Float32Array from the result data
      const resultArray = new Float32Array(Array.from(resultData));
      
      tf.dispose([tensor, result]);
      
      return resultArray;
    } catch (error) {
      console.error('Error processing signal with TensorFlow:', error);
      return null;
    }
  }

  /**
   * Clean up resources when no longer needed
   */
  public dispose(): void {
    // Dispose all cached models
    this.modelCache.forEach(model => {
      model.dispose();
    });
    this.modelCache.clear();
    
    // Memory cleanup
    tf.disposeVariables();
    this.isInitialized = false;
  }
}
