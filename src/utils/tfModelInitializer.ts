
/**
 * Tensor memory management wrapper with performance monitoring
 */
export async function runWithMemoryManagement<T>(
  tfFunction: () => Promise<T> | T,
  options: {
    maxTensors?: number;
    logPerformance?: boolean;
  } = {}
): Promise<T> {
  const startTime = performance.now();
  const startingTensorCount = tf.memory().numTensors;
  let result: T;
  
  try {
    // Create a wrapper function that returns the result directly
    // This fixes the typing issues with tf.tidy
    const runFunction = async () => {
      return await tfFunction();
    };
    
    // Run TensorFlow operations
    result = await runFunction();
    
    // Check memory usage
    const currentTensorCount = tf.memory().numTensors;
    const tensorDelta = currentTensorCount - startingTensorCount;
    
    // Clean up if too many tensors remain
    const maxTensors = options.maxTensors || 100;
    if (currentTensorCount > maxTensors) {
      console.warn(`High tensor count detected: ${currentTensorCount}. Performing targeted cleanup.`);
      tf.disposeVariables();
    }
    
    // Log performance metrics
    if (options.logPerformance) {
      const endTime = performance.now();
      console.log(`TensorFlow operation completed:`, {
        executionTime: `${(endTime - startTime).toFixed(2)}ms`,
        startingTensorCount,
        endingTensorCount: tf.memory().numTensors,
        tensorDelta: tensorDelta > 0 ? `+${tensorDelta}` : tensorDelta,
        memoryUsage: `${(tf.memory().numBytes / (1024 * 1024)).toFixed(2)} MB`
      });
    }
    
    return result;
  } catch (error) {
    console.error('TensorFlow operation failed:', error);
    
    // Emergency cleanup on error
    tf.engine().disposeVariables();
    
    throw error;
  }
}
