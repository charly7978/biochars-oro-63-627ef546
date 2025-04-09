
// Remove the converters usage on line 119 since it doesn't exist
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

// Fix the runWithMemoryManagement function to handle the proper types for tf.tidy
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
