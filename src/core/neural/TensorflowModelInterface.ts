
import * as tf from '@tensorflow/tfjs';

/**
 * Standardized TensorFlow model interface
 * Provides consistent methods for all neural models
 */
export interface TensorflowModelInterface {
  /**
   * Load model from URL
   */
  load(url: string): Promise<boolean>;
  
  /**
   * Process signal data
   */
  process(signalData: number[]): Promise<Float32Array | null>;
  
  /**
   * Get model information
   */
  getInfo(): ModelInformation;
  
  /**
   * Check if model is ready for inference
   */
  isReady(): boolean;
  
  /**
   * Reset model state
   */
  reset(): void;
  
  /**
   * Release resources
   */
  dispose(): void;
}

/**
 * Model information
 */
export interface ModelInformation {
  id: string;
  name: string;
  version: string;
  description: string;
  inputShape: number[];
  outputShape: number[];
  accelerated: boolean;
  lastUsed?: Date;
  performance?: {
    avgInferenceTime: number;
    totalInferences: number;
  };
}

/**
 * Base TensorFlow model implementation
 */
export abstract class BaseTensorflowModel implements TensorflowModelInterface {
  protected model: tf.LayersModel | null = null;
  protected isLoaded: boolean = false;
  protected useWebGPU: boolean = false;
  protected inferenceCount: number = 0;
  protected totalInferenceTime: number = 0;
  
  /**
   * Create a new TensorFlow model
   */
  constructor(
    protected readonly modelId: string,
    protected readonly modelName: string,
    protected readonly modelVersion: string,
    protected readonly modelDescription: string
  ) {}
  
  /**
   * Load model from URL
   */
  public async load(url: string): Promise<boolean> {
    try {
      if (this.model) {
        this.dispose();
      }
      
      // Check if WebGPU is available
      this.useWebGPU = tf.getBackend() === 'webgpu';
      
      // Load model
      this.model = await tf.loadLayersModel(url);
      this.isLoaded = true;
      
      return true;
    } catch (error) {
      console.error(`Failed to load model ${this.modelId}:`, error);
      return false;
    }
  }
  
  /**
   * Process signal data
   */
  public async process(signalData: number[]): Promise<Float32Array | null> {
    if (!this.model || !this.isLoaded) {
      console.warn(`Model ${this.modelId} not loaded`);
      return null;
    }
    
    try {
      const startTime = performance.now();
      
      // Prepare input tensor
      const inputTensor = this.prepareInput(signalData);
      
      // Run inference
      const result = this.model.predict(inputTensor) as tf.Tensor;
      
      // Get output data
      const resultData = await result.data();
      
      // Convert to Float32Array
      const resultArray = new Float32Array(Array.from(resultData));
      
      // Clean up tensors
      tf.dispose([inputTensor, result]);
      
      // Update performance metrics
      const inferenceTime = performance.now() - startTime;
      this.inferenceCount++;
      this.totalInferenceTime += inferenceTime;
      
      return resultArray;
    } catch (error) {
      console.error(`Error processing data with model ${this.modelId}:`, error);
      return null;
    }
  }
  
  /**
   * Prepare input tensor for the model
   */
  protected abstract prepareInput(signalData: number[]): tf.Tensor;
  
  /**
   * Get model information
   */
  public getInfo(): ModelInformation {
    return {
      id: this.modelId,
      name: this.modelName,
      version: this.modelVersion,
      description: this.modelDescription,
      inputShape: this.model?.inputs[0]?.shape || [],
      outputShape: this.model?.outputs[0]?.shape || [],
      accelerated: this.useWebGPU,
      lastUsed: this.inferenceCount > 0 ? new Date() : undefined,
      performance: this.inferenceCount > 0 ? {
        avgInferenceTime: this.totalInferenceTime / this.inferenceCount,
        totalInferences: this.inferenceCount
      } : undefined
    };
  }
  
  /**
   * Check if model is ready for inference
   */
  public isReady(): boolean {
    return this.isLoaded && this.model !== null;
  }
  
  /**
   * Reset model state
   */
  public reset(): void {
    this.inferenceCount = 0;
    this.totalInferenceTime = 0;
  }
  
  /**
   * Release resources
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isLoaded = false;
  }
}
