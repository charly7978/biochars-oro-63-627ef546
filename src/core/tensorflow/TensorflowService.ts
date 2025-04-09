
/**
 * TensorFlow.js integration service
 * Provides hardware-accelerated computation for vital signs processing
 */
import * as tf from '@tensorflow/tfjs';
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';

export class TensorflowService {
  private initialized: boolean = false;
  private preferredDevice: string = 'webgl';
  private modelCache: Map<string, tf.LayersModel> = new Map();
  private optimizationEnabled: boolean = true;

  /**
   * Initialize TensorFlow backend with optimal settings
   */
  public async initialize(): Promise<boolean> {
    try {
      console.log('TensorflowService: Initializing TensorFlow.js backend');
      
      // Check for WebGL2, WebGPU, or fallback to CPU
      if (await tf.backend().getGPGPUContext?.()) {
        this.preferredDevice = 'webgl';
      } else if (navigator.gpu && tf.backend('webgpu')) {
        this.preferredDevice = 'webgpu';
      } else {
        this.preferredDevice = 'cpu';
        console.log('TensorflowService: Hardware acceleration not available, using CPU');
      }
      
      // Set the backend
      await tf.setBackend(this.preferredDevice);
      
      // Enable memory optimization
      tf.enableProdMode();
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
      tf.env().set('WEBGL_PACK_DEPTHWISECONV', true);
      
      // Set flags for optimal performance
      tf.env().set('WEBGL_CPU_FORWARD', false);
      tf.env().set('WEBGL_PACK', true);
      
      this.initialized = true;
      console.log(`TensorflowService: Initialized with ${this.preferredDevice} backend`);
      
      return true;
    } catch (error) {
      console.error('TensorflowService: Initialization failed', error);
      this.preferredDevice = 'cpu';
      
      // Try fallback to CPU
      try {
        await tf.setBackend('cpu');
        this.initialized = true;
        console.log('TensorflowService: Fallback to CPU successful');
        return true;
      } catch (fallbackError) {
        console.error('TensorflowService: Fallback initialization failed', fallbackError);
        return false;
      }
    }
  }
  
  /**
   * Create a tensor from PPG signal data
   */
  public createTensor(signal: number[]): tf.Tensor {
    if (!this.initialized) {
      throw new Error('TensorflowService not initialized');
    }
    
    // Ensure we clean up previous tensors to prevent memory leaks
    tf.tidy(() => {
      return tf.tensor1d(signal);
    });
    
    return tf.tensor1d(signal);
  }
  
  /**
   * Process PPG signal using TensorFlow optimized operations
   * This provides faster computation than manual JS calculations
   */
  public processPPGSignal(signal: number[]): tf.Tensor {
    if (!this.initialized) {
      throw new Error('TensorflowService not initialized');
    }
    
    return tf.tidy(() => {
      const tensor = tf.tensor1d(signal);
      
      // Mean normalization
      const mean = tensor.mean();
      const normalized = tensor.sub(mean);
      
      // Apply smoothing using TF operations (equivalent to moving average)
      const smoothed = this.applySmoothing(normalized);
      
      return smoothed;
    });
  }
  
  /**
   * Apply smoothing filter using TensorFlow ops
   */
  private applySmoothing(tensor: tf.Tensor1D, windowSize: number = 5): tf.Tensor1D {
    const weights = tf.ones([windowSize]).div(tf.scalar(windowSize));
    const paddedTensor = tf.pad(tensor, [[Math.floor(windowSize/2), Math.floor(windowSize/2)]]);
    return tf.conv1d(
      paddedTensor.expandDims(1), 
      weights.expandDims(1).expandDims(1), 
      1, 'valid'
    ).squeeze();
  }
  
  /**
   * Load and cache a TensorFlow.js model
   */
  public async loadModel(modelUrl: string, modelKey: string): Promise<tf.LayersModel> {
    if (this.modelCache.has(modelKey)) {
      return this.modelCache.get(modelKey)!;
    }
    
    try {
      const model = await tf.loadLayersModel(modelUrl);
      this.modelCache.set(modelKey, model);
      console.log(`TensorflowService: Loaded model ${modelKey}`);
      return model;
    } catch (error) {
      console.error(`TensorflowService: Failed to load model ${modelKey}`, error);
      throw error;
    }
  }
  
  /**
   * Run prediction using loaded model
   */
  public async predict(modelKey: string, inputTensor: tf.Tensor): Promise<tf.Tensor> {
    if (!this.modelCache.has(modelKey)) {
      throw new Error(`Model ${modelKey} not loaded`);
    }
    
    const model = this.modelCache.get(modelKey)!;
    
    return tf.tidy(() => {
      return model.predict(inputTensor) as tf.Tensor;
    });
  }
  
  /**
   * Calculate signal characteristics using TensorFlow
   * Much more efficient than manual calculation
   */
  public calculateSignalCharacteristics(signal: tf.Tensor1D): {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    range: number;
  } {
    return tf.tidy(() => {
      const min = signal.min().dataSync()[0];
      const max = signal.max().dataSync()[0];
      const mean = signal.mean().dataSync()[0];
      const variance = tf.moments(signal).variance.dataSync()[0];
      const stdDev = Math.sqrt(variance);
      
      return {
        min,
        max,
        mean,
        stdDev,
        range: max - min
      };
    });
  }
  
  /**
   * Memory cleanup
   */
  public dispose(): void {
    // Dispose all cached models
    this.modelCache.forEach(model => model.dispose());
    this.modelCache.clear();
    
    // Force garbage collection
    if (tf.engine) {
      tf.engine().endScope();
      tf.engine().disposeVariables();
    }
    
    console.log('TensorflowService: Resources disposed');
  }
  
  /**
   * Provide backend information
   */
  public getBackendInfo(): {
    initialized: boolean;
    backend: string;
    memoryInfo: tf.MemoryInfo | null;
  } {
    if (!this.initialized) {
      return {
        initialized: false,
        backend: 'none',
        memoryInfo: null
      };
    }
    
    return {
      initialized: true,
      backend: tf.getBackend(),
      memoryInfo: tf.memory()
    };
  }
}

// Create singleton instance
export const tensorflowService = new TensorflowService();
