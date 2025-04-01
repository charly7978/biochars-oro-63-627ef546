/**
 * Centralized TensorFlow service for model management and inference
 */
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';

// Model types for vital signs processing
export enum ModelType {
  SPO2 = 'spo2',
  BLOOD_PRESSURE = 'blood-pressure',
  GLUCOSE = 'glucose',
  LIPIDS = 'lipids',
  CARDIAC = 'cardiac',
  DENOISING = 'denoising'
}

// Inference options
export interface InferenceOptions {
  useWebGPU?: boolean;
  batchSize?: number;
  confidenceThreshold?: number;
}

/**
 * Main TensorFlow service class
 * Provides model loading, inference, and acceleration management
 */
export class TensorFlowService {
  private static instance: TensorFlowService;
  private models: Map<string, tf.LayersModel> = new Map();
  private isWebGPUEnabled: boolean = false;
  private modelBaseUrl: string = 'https://storage.googleapis.com/vital-signs-models/';
  
  // Default options
  private defaultOptions: InferenceOptions = {
    useWebGPU: true,
    batchSize: 1,
    confidenceThreshold: 0.5
  };

  private constructor() {
    // Initialize TensorFlow
    this.initializeTensorFlow();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): TensorFlowService {
    if (!TensorFlowService.instance) {
      TensorFlowService.instance = new TensorFlowService();
    }
    return TensorFlowService.instance;
  }

  /**
   * Initialize TensorFlow and try to enable WebGPU acceleration
   */
  private async initializeTensorFlow(): Promise<void> {
    try {
      // Try to use WebGPU backend for acceleration
      await tf.setBackend('webgpu');
      await tf.ready();
      this.isWebGPUEnabled = true;
      console.log('TensorFlowService: WebGPU acceleration enabled');
    } catch (error) {
      // Fall back to WebGL or CPU
      console.warn('TensorFlowService: WebGPU not available, using fallback backend', error);
      
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        console.log('TensorFlowService: Using WebGL backend');
      } catch (webglError) {
        console.warn('TensorFlowService: WebGL not available, using CPU backend', webglError);
      }
    }
    
    console.log('TensorFlowService: Initialized with backend:', tf.getBackend());
  }

  /**
   * Load a model for specific vital sign processing
   */
  public async loadModel(modelType: ModelType, modelVersion: string = 'v1'): Promise<tf.LayersModel | null> {
    const modelKey = `${modelType}-${modelVersion}`;
    
    // Return model if already loaded
    if (this.models.has(modelKey)) {
      return this.models.get(modelKey) || null;
    }
    
    try {
      // Construct model URL
      const modelUrl = `${this.modelBaseUrl}${modelType}/${modelVersion}/model.json`;
      console.log(`TensorFlowService: Loading model from ${modelUrl}`);
      
      // Load model
      const model = await tf.loadLayersModel(modelUrl);
      this.models.set(modelKey, model);
      
      console.log(`TensorFlowService: Successfully loaded model ${modelKey}`);
      return model;
    } catch (error) {
      console.error(`TensorFlowService: Error loading model ${modelType}-${modelVersion}:`, error);
      return null;
    }
  }

  /**
   * Run inference on a signal using a specified model
   */
  public async runInference(
    signal: number[], 
    modelType: ModelType, 
    modelVersion: string = 'v1',
    options?: Partial<InferenceOptions>
  ): Promise<{prediction: number[], confidence: number}> {
    // Merge options with defaults
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    try {
      // Load model if not already loaded
      const model = await this.loadModel(modelType, modelVersion);
      if (!model) {
        throw new Error(`Model ${modelType}-${modelVersion} could not be loaded`);
      }
      
      // Prepare input tensor
      const normalizedSignal = this.normalizeSignal(signal);
      const inputTensor = tf.tensor2d(normalizedSignal, [1, normalizedSignal.length]);
      
      // Run inference
      const predictionTensor = model.predict(inputTensor) as tf.Tensor;
      const predictionArray = await predictionTensor.array() as number[][];
      
      // Calculate confidence
      // Assume the model outputs [prediction, confidence] or extract confidence from output
      const prediction = predictionArray[0];
      const confidence = this.calculateConfidence(prediction);
      
      // Cleanup tensors
      tf.dispose([inputTensor, predictionTensor]);
      
      return {
        prediction: prediction,
        confidence: confidence
      };
    } catch (error) {
      console.error('TensorFlowService: Inference error:', error);
      // Return safe fallback values
      return {
        prediction: [0],
        confidence: 0
      };
    }
  }

  /**
   * Run a denoising autoencoder on a signal
   */
  public async enhanceSignal(
    signal: number[],
    options?: Partial<InferenceOptions>
  ): Promise<number[]> {
    try {
      // Load denoising model
      const model = await this.loadModel(ModelType.DENOISING);
      if (!model) {
        console.warn('TensorFlowService: Denoising model not available, returning original signal');
        return signal;
      }
      
      // Normalize signal
      const normalizedSignal = this.normalizeSignal(signal);
      const inputTensor = tf.tensor2d(normalizedSignal, [1, normalizedSignal.length]);
      
      // Run autoencoder
      const enhancedTensor = model.predict(inputTensor) as tf.Tensor;
      const enhancedArray = await enhancedTensor.array() as number[][];
      
      // Clean up tensors
      tf.dispose([inputTensor, enhancedTensor]);
      
      // Denormalize if original signal wasn't normalized
      const maxValue = Math.max(...signal);
      if (maxValue > 1) {
        return enhancedArray[0].map(val => val * maxValue);
      }
      
      return enhancedArray[0];
    } catch (error) {
      console.error('TensorFlowService: Error enhancing signal:', error);
      return signal; // Return original on error
    }
  }

  /**
   * Normalize a signal for neural network processing
   */
  private normalizeSignal(signal: number[]): number[] {
    // Skip if signal is already normalized
    if (Math.max(...signal) <= 1) {
      return signal;
    }
    
    const maxValue = Math.max(...signal);
    return signal.map(val => val / maxValue);
  }

  /**
   * Calculate confidence based on model output
   */
  private calculateConfidence(prediction: number[]): number {
    // If model directly provides confidence value
    if (prediction.length >= 2) {
      return prediction[1]; // Second output is confidence
    }
    
    // Otherwise use a simple heuristic based on output values
    return Math.min(0.95, Math.max(0.1, Math.abs(prediction[0]) / 100));
  }

  /**
   * Check if WebGPU acceleration is available
   */
  public isWebGPUAvailable(): boolean {
    return this.isWebGPUEnabled;
  }

  /**
   * Get information about the current TensorFlow setup
   */
  public getTensorFlowInfo(): {backend: string, webgpuEnabled: boolean, modelsLoaded: string[]} {
    return {
      backend: tf.getBackend() || 'unknown',
      webgpuEnabled: this.isWebGPUEnabled,
      modelsLoaded: Array.from(this.models.keys())
    };
  }
}

// Create and export singleton instance
export const tensorflowService = TensorFlowService.getInstance();
