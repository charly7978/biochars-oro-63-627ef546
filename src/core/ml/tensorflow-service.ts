
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
  private initPromise: Promise<boolean> | null = null;

  constructor(config: ProcessorConfig) {
    this.config = config;
  }

  /**
   * Initialize TensorFlow.js with WebGPU if available
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    
    // Use promise caching to prevent multiple simultaneous initializations
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this._initializeInternal();
    return this.initPromise;
  }
  
  private async _initializeInternal(): Promise<boolean> {
    try {
      console.log('TensorFlow.js initializing...');
      
      // Check if WebGPU is available
      if (this.config.useWebGPU && await this.isWebGPUAvailable()) {
        await tf.setBackend('webgpu');
        
        // Apply memory optimization settings for WebGPU
        if (tf.env().getFlags().WEBGPU_USE_PROGRAM_CACHE === undefined) {
          tf.env().set('WEBGPU_USE_PROGRAM_CACHE', true);
        }
        
        this.useWebGPU = true;
        console.log('TensorFlow.js using WebGPU acceleration');
      } else {
        await tf.setBackend('webgl');
        
        // Apply memory optimization settings for WebGL
        if (tf.env().getFlags().WEBGL_CPU_FORWARD === undefined) {
          tf.env().set('WEBGL_CPU_FORWARD', false);
        }
        if (tf.env().getFlags().WEBGL_PACK === undefined) {
          tf.env().set('WEBGL_PACK', true);
        }
        
        console.log('TensorFlow.js using WebGL fallback');
      }
      
      await tf.ready();
      this.isInitialized = true;
      
      console.log(`TensorFlow.js initialized. Version: ${tf.version.tfjs}, Backend: ${this.getBackend()}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize TensorFlow.js:', error);
      return false;
    } finally {
      this.initPromise = null;
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
      // Check cache first
      if (this.modelCache.has(modelKey)) {
        return this.modelCache.get(modelKey)!;
      }

      // Ensure TensorFlow is initialized before loading
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      console.log(`Loading model: ${modelKey} from ${modelUrl}`);
      const loadStartTime = performance.now();
      
      // Load model with optimization options
      const model = await tf.loadLayersModel(modelUrl, {
        strict: false,
        weightLoaderFactory: () => {
          // Apply custom weight loading optimization
          return {
            load: async (weightManifest) => {
              // Standard loader implementation with improved caching
              const fetchWeights = async (weightPath: string) => {
                const response = await fetch(weightPath, { cache: 'force-cache' });
                return response.arrayBuffer();
              };
              
              // Load all weight files in parallel for better performance
              const weightPromises = weightManifest.map(group => {
                return Promise.all(group.paths.map(fetchWeights));
              });
              
              return await Promise.all(weightPromises);
            }
          };
        }
      });
      
      const loadTime = performance.now() - loadStartTime;
      console.log(`Model ${modelKey} loaded in ${loadTime.toFixed(2)}ms`);
      
      // Apply memory optimization if using WebGPU
      if (this.useWebGPU) {
        // Compile model for faster inference
        if (model.compile && typeof model.compile === 'function') {
          model.compile({
            optimizer: 'sgd',
            loss: 'meanSquaredError'
          });
        }
      }
      
      // Cache model
      this.modelCache.set(modelKey, model);
      return model;
    } catch (error) {
      console.error(`Failed to load model ${modelKey}:`, error);
      return null;
    }
  }

  /**
   * Process signal data through neural network with optimized memory management
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

      // Begin performance measurement
      const startTime = performance.now();
      
      // Create a memory-efficient tensor with proper typed array
      const tensorData = Float32Array.from(signalData);
      const tensor = tf.tensor(tensorData, inputShape);
      
      // Minimize memory allocations by using tidy for auto cleanup
      const resultData = await tf.tidy(() => {
        // Run inference
        const result = model.predict(tensor) as tf.Tensor;
        return result.data();
      });
      
      // Create a new Float32Array from the result data for better memory management
      const resultArray = new Float32Array(Array.from(resultData));
      
      // Dispose input tensor (result tensor already disposed by tidy)
      tensor.dispose();
      
      // Log performance for optimization tracking
      const processingTime = performance.now() - startTime;
      if (processingTime > 20) {
        console.log(`TensorFlow processing took ${processingTime.toFixed(2)}ms for model ${modelKey}`);
      }
      
      return resultArray;
    } catch (error) {
      console.error('Error processing signal with TensorFlow:', error);
      return null;
    }
  }

  /**
   * Get the current TensorFlow.js backend
   */
  public getBackend(): string {
    return tf.getBackend() || 'none';
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
    
    // Force garbage collection where supported
    if (window.gc) {
      try {
        window.gc();
      } catch (e) {
        console.log('Manual garbage collection not available');
      }
    }
  }
}
