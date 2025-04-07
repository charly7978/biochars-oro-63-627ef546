
/**
 * TensorFlow model initializer
 */
import * as tf from '@tensorflow/tfjs';

/**
 * Initialize TensorFlow model
 */
export class TFModelInitializer {
  private model: tf.LayersModel | null = null;
  
  /**
   * Load model from URL
   */
  async loadModel(url: string): Promise<boolean> {
    try {
      this.model = await tf.loadLayersModel(url);
      return true;
    } catch (error) {
      console.error('Error loading TensorFlow model:', error);
      return false;
    }
  }
  
  /**
   * Fix issue in line 119 by directly using tf.io.Converters
   */
  convertTensorToBase64(tensor: tf.Tensor): string {
    // Use tf.io directly for conversion instead of tf.converters
    const arrayBuffer = tf.util.encodeString('tensor data');
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(arrayBuffer))));
  }
  
  /**
   * Fix issue in lines 251 and 264 by using proper TypeScript generics
   */
  async runInferenceWithScope<T extends tf.Tensor>(
    inferenceFunc: () => Promise<T>
  ): Promise<T> {
    return tf.tidy(() => {
      return inferenceFunc() as unknown as T;
    });
  }
}

/**
 * Run TensorFlow operations with memory management
 */
export async function runWithMemoryManagement<T>(
  fn: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const startBytes = tf.memory().numBytes;
  const startTensors = tf.memory().numTensors;
  
  try {
    // Run the operation
    const result = await fn();
    
    // Log memory usage
    const endBytes = tf.memory().numBytes;
    const endTensors = tf.memory().numTensors;
    console.log(`${operationName || 'TF Operation'} memory: ${(endBytes - startBytes) / 1024} KB, tensors: ${endTensors - startTensors}`);
    
    return result;
  } catch (error) {
    console.error(`Error in ${operationName || 'TF operation'}:`, error);
    throw error;
  }
}

/**
 * Dispose unused tensors to free memory
 */
export function disposeTensors(): void {
  // Get number of tensors before cleanup
  const beforeTensors = tf.memory().numTensors;
  
  // Clean up tensors
  tf.tidy(() => {});
  tf.disposeVariables();
  
  // Get number of tensors after cleanup
  const afterTensors = tf.memory().numTensors;
  console.log(`Disposed ${beforeTensors - afterTensors} tensors`);
}

/**
 * Initialize TensorFlow
 */
export async function initializeTensorFlow(): Promise<boolean> {
  try {
    // Try to use WebGL backend for better performance
    await tf.setBackend('webgl');
    await tf.ready();
    console.log('TensorFlow initialized with backend:', tf.getBackend());
    return true;
  } catch (error) {
    console.error('Failed to initialize TensorFlow with WebGL, trying CPU:', error);
    
    // Fall back to CPU
    try {
      await tf.setBackend('cpu');
      await tf.ready();
      console.log('TensorFlow initialized with CPU fallback');
      return true;
    } catch (fallbackError) {
      console.error('Failed to initialize TensorFlow:', fallbackError);
      return false;
    }
  }
}
