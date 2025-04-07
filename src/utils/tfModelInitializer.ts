
import * as tf from '@tensorflow/tfjs';

// Check for graph model conversion
export function checkModelForConversion(model: any): void {
  // Remove the converters usage since it doesn't exist
  // Replace with a simple check and log
  if (model && 'then' in model) {
    try {
      // Cannot convert to graph model since converters API is not available
      console.warn('Model conversion to graph model not available in this TensorFlow.js version');
      // Continue with the original model
    } catch (optimizeError) {
      console.warn('Could not convert to graph model:', optimizeError);
      // Continue with the original model
    }
  }
}

// Get current memory usage for tensor management
export function getMemoryUsage() {
  const current = {
    numTensors: tf.memory().numTensors,
    numMB: tf.memory().numBytes / (1024 * 1024)
  };
  
  return {
    current
  };
}

// Dispose tensors to free memory
export function disposeTensors(): void {
  try {
    tf.disposeVariables();
    const tensors = tf.memory().numTensors;
    
    if (tensors > 0) {
      tf.dispose();
      console.log(`Disposed ${tensors} tensors`);
    }
  } catch (error) {
    console.error('Error disposing tensors:', error);
  }
}

// Initialize TensorFlow with optimal backend
export async function initializeTensorFlow(): Promise<boolean> {
  try {
    // Check if TensorFlow is already initialized
    if (tf.getBackend()) {
      console.log('TensorFlow already initialized with backend:', tf.getBackend());
      return true;
    }
    
    // Try to use WebGL first (for better performance)
    await tf.setBackend('webgl');
    await tf.ready();
    console.log('TensorFlow initialized with WebGL backend');
    return true;
  } catch (error) {
    console.warn('Failed to initialize WebGL backend, trying CPU fallback', error);
    
    try {
      // Fall back to CPU if WebGL fails
      await tf.setBackend('cpu');
      await tf.ready();
      console.log('TensorFlow initialized with CPU backend');
      return true;
    } catch (fallbackError) {
      console.error('Failed to initialize TensorFlow:', fallbackError);
      return false;
    }
  }
}

/**
 * Tensor memory management wrapper with enhanced error handling
 */
export async function runWithMemoryManagement<T>(
  tfFunction: () => Promise<T>,
  functionName: string = 'tfOperation'
): Promise<T> {
  const startTime = performance.now();
  const startMemory = tf.memory();
  
  try {
    // Since we can't use async functions directly with tf.tidy, we'll run our operation
    // and then clean up manually after it completes
    const result = await tfFunction();
    
    // Clean up tensors after the operation
    tf.engine().endScope();
    
    // Calculate performance metrics
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    
    // Log performance for operations taking more than 50ms (potential bottlenecks)
    if (processingTime > 50) {
      console.log(`⏱️ ${functionName} completed in ${processingTime.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ TensorFlow operation '${functionName}' failed:`, error);
    
    // Log memory state when error occurred
    const errorMemory = tf.memory();
    console.error('Memory state at error:', {
      numTensors: errorMemory.numTensors,
      numBytes: (errorMemory.numBytes / (1024 * 1024)).toFixed(2) + ' MB'
    });
    
    // Do emergency cleanup
    tf.engine().endScope();
    disposeTensors();
    
    // Rethrow the error
    throw error;
  }
}
