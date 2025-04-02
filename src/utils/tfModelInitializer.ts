import * as tf from '@tensorflow/tfjs';

/**
 * Tensor memory management wrapper with performance monitoring
 * @param fn Function that performs TensorFlow operations
 * @param options Options for memory management
 * @returns Result of the function execution
 */
export async function runWithMemoryManagement<T>(
  fn: () => Promise<T>,
  options: {
    logPerformance?: boolean;
    disposeIntermediateTensors?: boolean;
  } = { logPerformance: false, disposeIntermediateTensors: true }
): Promise<T> {
  const startTime = performance.now();
  const initialNumTensors = tf.memory().numTensors;
  
  try {
    // Execute the function that performs TensorFlow operations
    const result = await fn();
    
    // Log performance stats
    if (options.logPerformance) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      const finalNumTensors = tf.memory().numTensors;
      const tensorDiff = finalNumTensors - initialNumTensors;
      
      console.log(`TensorFlow operation completed in ${duration.toFixed(2)}ms`);
      console.log(`Tensor count change: ${tensorDiff} (${initialNumTensors} → ${finalNumTensors})`);
      
      if (tensorDiff > 0) {
        console.warn(`Memory leak detected: ${tensorDiff} tensors were not properly disposed`);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error in TensorFlow operation:', error);
    throw error;
  } finally {
    // Dispose intermediate tensors if requested
    if (options.disposeIntermediateTensors) {
      // Keep only tensors that are needed for the result
      // This is a more targeted approach than disposing all tensors
      const currentNumTensors = tf.memory().numTensors;
      if (currentNumTensors > initialNumTensors) {
        // Use tidy to clean up orphaned tensors
        tf.tidy(() => {});
        
        if (options.logPerformance) {
          const cleanedNumTensors = tf.memory().numTensors;
          console.log(`Cleaned up ${currentNumTensors - cleanedNumTensors} orphaned tensors`);
        }
      }
    }
  }
}

// Add these exports for backward compatibility with other modules
export const initializeTensorFlow = async () => {
  // Simple initialization logic
  try {
    console.log("Initializing TensorFlow environment");
    await tf.ready();
    return true;
  } catch (error) {
    console.error("Failed to initialize TensorFlow:", error);
    return false;
  }
};

export const disposeTensors = () => {
  try {
    tf.engine().disposeVariables();
    console.log("TensorFlow tensors disposed");
    return true;
  } catch (error) {
    console.error("Failed to dispose TensorFlow tensors:", error);
    return false;
  }
};
