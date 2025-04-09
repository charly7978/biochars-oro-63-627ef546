
import * as tf from '@tensorflow/tfjs';
import { toast } from '@/hooks/use-toast';

// Model cache to prevent reloading
const modelCache: Record<string, tf.LayersModel | tf.GraphModel> = {};

/**
 * Initialize TensorFlow.js and load backend
 */
export async function initializeTensorFlow(): Promise<boolean> {
  try {
    // Try to initialize WebGL backend for performance
    await tf.setBackend('webgl');
    await tf.ready();
    
    // Log success with version and backend info
    console.log(`TensorFlow.js initialized successfully:`, {
      version: tf.version.tfjs,
      backend: tf.getBackend(),
      isWebGLAvailable: tf.ENV.getBool('HAS_WEBGL'),
      // Safe check for deviceMemory - some browsers may not support it
      deviceMemory: typeof navigator !== 'undefined' && 
                    navigator && 
                    'deviceMemory' in navigator ? 
                    (navigator as any).deviceMemory : 'unknown',
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize TensorFlow.js:', error);
    
    // Try to fall back to CPU backend
    try {
      await tf.setBackend('cpu');
      await tf.ready();
      console.log('TensorFlow.js initialized with CPU backend fallback');
      toast({
        title: "Using CPU for processing",
        description: "GPU acceleration not available. Performance may be reduced.",
        variant: "destructive"
      });
      return true;
    } catch (fallbackError) {
      console.error('Failed to initialize TensorFlow.js with fallback:', fallbackError);
      toast({
        title: "TensorFlow initialization failed",
        description: "Advanced signal processing unavailable",
        variant: "destructive"
      });
      return false;
    }
  }
}

/**
 * Load and cache TF models
 */
export async function loadModel(modelUrl: string, modelType: 'layers' | 'graph' = 'layers'): Promise<tf.LayersModel | tf.GraphModel | null> {
  try {
    // Return cached model if available
    if (modelCache[modelUrl]) {
      return modelCache[modelUrl];
    }
    
    console.log(`Loading ${modelType} model from ${modelUrl}...`);
    
    const loadStartTime = performance.now();
    let model: tf.LayersModel | tf.GraphModel;
    
    if (modelType === 'layers') {
      model = await tf.loadLayersModel(modelUrl);
    } else {
      model = await tf.loadGraphModel(modelUrl);
    }
    
    const loadTime = performance.now() - loadStartTime;
    console.log(`Model loaded successfully in ${loadTime.toFixed(2)}ms`);
    
    // Cache the model
    modelCache[modelUrl] = model;
    return model;
  } catch (error) {
    console.error(`Error loading model from ${modelUrl}:`, error);
    toast({
      title: "Failed to load ML model",
      description: "Some features may not work correctly",
      variant: "destructive"
    });
    return null;
  }
}

/**
 * Clean up TensorFlow memory
 */
export function disposeTensors(): void {
  try {
    // Get number of tensors before disposal
    const numTensorsBefore = tf.memory().numTensors;
    
    // Dispose unused tensors
    tf.disposeVariables();
    tf.dispose();
    
    const numTensorsAfter = tf.memory().numTensors;
    console.log(`Disposed TensorFlow tensors: ${numTensorsBefore - numTensorsAfter} tensors freed`);
  } catch (error) {
    console.error('Error disposing TensorFlow tensors:', error);
  }
}

/**
 * Create a simple sequential model for signal processing
 */
export function createSignalProcessingModel(): tf.Sequential {
  try {
    const model = tf.sequential();
    
    // Add a 1D convolutional layer to extract features from the signal
    model.add(tf.layers.conv1d({
      inputShape: [30, 1],
      filters: 16,
      kernelSize: 5,
      activation: 'relu',
      padding: 'same'
    }));
    
    // Add a max pooling layer
    model.add(tf.layers.maxPooling1d({
      poolSize: 2,
      strides: 2
    }));
    
    // Add a flatten layer
    model.add(tf.layers.flatten());
    
    // Add a dense layer for output
    model.add(tf.layers.dense({
      units: 1,
      activation: 'linear'
    }));
    
    // Compile the model
    model.compile({
      optimizer: tf.train.adam(),
      loss: 'meanSquaredError',
      metrics: ['mse']
    });
    
    return model;
  } catch (error) {
    console.error('Error creating signal processing model:', error);
    throw new Error('Failed to create TensorFlow model');
  }
}

/**
 * Tensor memory management wrapper
 */
export async function runWithMemoryManagement<T>(
  tfFunction: () => Promise<T>
): Promise<T> {
  let result: T;
  try {
    // Run function with TensorFlow operations
    result = await tfFunction();
    
    // Clean up tensors after operation
    const tensorsToDispose = tf.memory().numTensors;
    if (tensorsToDispose > 100) {
      console.warn(`High tensor count detected: ${tensorsToDispose}. Performing cleanup.`);
      tf.tidy(() => {});
    }
    
    return result;
  } catch (error) {
    console.error('TensorFlow operation failed:', error);
    throw error;
  }
}
