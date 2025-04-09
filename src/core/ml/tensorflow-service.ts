
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
  private lastPerformanceLog: number = 0;

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
      
      // Check if WebGPU is available with more reliable detection
      if (this.config.useWebGPU && await this.isWebGPUAvailable()) {
        // Apply optimal memory settings before setting backend
        tf.env().set('WEBGPU_USE_PROGRAM_CACHE', true);
        tf.env().set('WEBGPU_CPU_FORWARD', false);
        
        await tf.setBackend('webgpu');
        this.useWebGPU = true;
        console.log('TensorFlow.js using WebGPU acceleration with optimized settings');
      } else {
        // WebGL fallback with optimized settings
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
        tf.env().set('WEBGL_PACK', true);
        tf.env().set('WEBGL_CPU_FORWARD', false);
        tf.env().set('WEBGL_PACK_DEPTHWISECONV', true);
        
        await tf.setBackend('webgl');
        console.log('TensorFlow.js using WebGL fallback with optimized settings');
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
      // Enhanced WebGPU checking
      if (!navigator.gpu) {
        console.log('WebGPU not supported - navigator.gpu missing');
        return false;
      }
      
      // Try to request adapter to confirm availability
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });
      
      if (!adapter) {
        console.log('WebGPU adapter request failed');
        return false;
      }
      
      // Additional feature checking
      return true;
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
      
      // Load model with standard options
      const model = await tf.loadLayersModel(modelUrl, {
        strict: false
      });
      
      const loadTime = performance.now() - loadStartTime;
      console.log(`Model ${modelKey} loaded in ${loadTime.toFixed(2)}ms`);
      
      // Apply memory optimization based on backend
      if (this.useWebGPU) {
        // Compile model for faster inference with WebGPU
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
      
      // Use tf.tidy with proper return type handling
      const resultTensor = tf.tidy(() => {
        // Run inference
        return model.predict(tensor) as tf.Tensor;
      });
      
      // Get data from the tensor (outside tidy to ensure proper disposal)
      const resultData = await resultTensor.data();
      
      // Create a new Float32Array from the result data for better memory management
      const resultArray = new Float32Array(resultData);
      
      // Dispose tensors
      tensor.dispose();
      resultTensor.dispose();
      
      // Log performance for optimization tracking (but limit frequency)
      const processingTime = performance.now() - startTime;
      const now = Date.now();
      if (now - this.lastPerformanceLog > 2000) { // Log at most every 2 seconds
        this.lastPerformanceLog = now;
        console.log(`TensorFlow processing: ${processingTime.toFixed(2)}ms for model ${modelKey} (${this.getBackend()})`);
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
