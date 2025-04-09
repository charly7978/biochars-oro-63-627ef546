import * as tf from '@tensorflow/tfjs';
import { toast } from '@/hooks/use-toast';

// Model cache to prevent reloading
const modelCache: Record<string, tf.LayersModel | tf.GraphModel> = {};

// Keep track of TensorFlow memory usage
const memoryUsageHistory: Array<{timestamp: number, numTensors: number, numMB: number}> = [];

/**
 * Initialize TensorFlow.js and load optimal backend
 * Attempts to use WebGPU first, then falls back to WebGL, and finally to CPU
 */
export async function initializeTensorFlow(): Promise<boolean> {
  try {
    // Check WebGPU availability first (higher performance)
    if (tf.engine().backendNames().includes('webgpu')) {
      try {
        await tf.setBackend('webgpu');
        await tf.ready();
        console.log('TensorFlow.js initialized with WebGPU backend for maximum performance');
        return true;
      } catch (webgpuError) {
        console.warn('WebGPU initialization failed, falling back to WebGL', webgpuError);
      }
    }
    
    // Try WebGL next
    await tf.setBackend('webgl');
    
    // Configure WebGL for better performance
    const gl = tf.ENV.getNumber('WEBGL_VERSION');
    if (gl === 2) {
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true); // Use F16 for better performance
      tf.env().set('WEBGL_PACK', true); // Enable texture packing
    }
    
    await tf.ready();
    
    // Log success with version and backend info
    console.log(`TensorFlow.js initialized successfully:`, {
      version: tf.version.tfjs,
      backend: tf.getBackend(),
      isWebGLAvailable: tf.ENV.getBool('HAS_WEBGL'),
      webGLVersion: gl,
      // Safe check for deviceMemory - some browsers may not support it
      deviceMemory: typeof navigator !== 'undefined' && 
                    navigator && 
                    'deviceMemory' in navigator ? 
                    (navigator as any).deviceMemory : 'unknown',
    });
    
    // Start memory monitoring
    startMemoryMonitoring();
    
    return true;
  } catch (error) {
    console.error('Failed to initialize TensorFlow.js with WebGL:', error);
    
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
      
      // Start memory monitoring even on CPU
      startMemoryMonitoring();
      
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
 * Load and cache TF models with quantization where supported
 */
export async function loadModel(
  modelUrl: string, 
  modelType: 'layers' | 'graph' = 'layers',
  enableQuantization: boolean = true
): Promise<tf.LayersModel | tf.GraphModel | null> {
  try {
    // Return cached model if available
    if (modelCache[modelUrl]) {
      return modelCache[modelUrl];
    }
    
    console.log(`Loading ${modelType} model from ${modelUrl}...`);
    
    const loadStartTime = performance.now();
    let model: tf.LayersModel | tf.GraphModel;
    
    // Set loading options with quantization for reduced size/faster inference
    const loadOptions: any = {};
    if (enableQuantization) {
      loadOptions.quantize = true; // Enable quantization where possible
    }
    
    if (modelType === 'layers') {
      model = await tf.loadLayersModel(modelUrl, loadOptions);
      
      // Try to optimize the model if it's a layers model
      if (model && 'then' in model) {
        try {
          // Convert to a graph model for better performance
          const graphModel = await tf.converters.convertTensorflowModelsToGraphModel(model);
          model = graphModel;
        } catch (optimizeError) {
          console.warn('Could not convert to graph model:', optimizeError);
          // Continue with the original model
        }
      }
    } else {
      model = await tf.loadGraphModel(modelUrl, loadOptions);
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
 * Clean up TensorFlow memory with enhanced monitoring
 */
export function disposeTensors(): void {
  try {
    // Get number of tensors before disposal
    const memoryBefore = tf.memory();
    const numTensorsBefore = memoryBefore.numTensors;
    const numBytesBefore = memoryBefore.numBytes;
    
    // Dispose unused variables and tensors
    tf.disposeVariables();
    
    // Use tidy to ensure proper cleanup
    tf.tidy(() => {
      // Empty tidy to clean up unnamed tensors
    });
    
    const memoryAfter = tf.memory();
    const numTensorsAfter = memoryAfter.numTensors;
    const numBytesAfter = memoryAfter.numBytes;
    
    // Log memory usage before and after cleanup
    console.log(`Disposed TensorFlow tensors:`, {
      tensorsFreed: numTensorsBefore - numTensorsAfter,
      memoryFreed: (numBytesBefore - numBytesAfter) / (1024 * 1024) + ' MB',
      remainingTensors: numTensorsAfter,
      remainingMemory: numBytesAfter / (1024 * 1024) + ' MB'
    });
    
    // If we still have a significant number of tensors, force a more aggressive cleanup
    if (numTensorsAfter > 100) {
      console.warn(`High tensor count after disposal (${numTensorsAfter}), forcing aggressive cleanup`);
      tf.engine().endScope(); // Force end any active scopes
      tf.engine().startScope(); // Start a fresh scope
    }
  } catch (error) {
    console.error('Error disposing TensorFlow tensors:', error);
  }
}

/**
 * Start periodic monitoring of TensorFlow memory usage
 */
function startMemoryMonitoring(): void {
  const memoryMonitoringInterval = setInterval(() => {
    try {
      const memory = tf.memory();
      const entry = {
        timestamp: Date.now(),
        numTensors: memory.numTensors,
        numMB: memory.numBytes / (1024 * 1024)
      };
      
      // Record memory usage
      memoryUsageHistory.push(entry);
      
      // Keep history limited to prevent memory leaks
      if (memoryUsageHistory.length > 100) {
        memoryUsageHistory.shift();
      }
      
      // Check for memory leaks
      if (memory.numTensors > 1000 || memory.numBytes > 100 * 1024 * 1024) {
        console.warn('⚠️ Possible TensorFlow memory leak detected:', entry);
        
        // Try to recover with aggressive cleanup
        disposeTensors();
        
        // Alert the user if situation is critical
        if (memory.numTensors > 5000 || memory.numBytes > 200 * 1024 * 1024) {
          toast({
            title: "High memory usage detected",
            description: "Performance may be affected. Consider restarting the application.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error('Error monitoring TensorFlow memory:', error);
    }
  }, 10000); // Check every 10 seconds
  
  // Clean up interval when the window unloads
  if (typeof window !== 'undefined') {
    window.addEventListener('unload', () => {
      clearInterval(memoryMonitoringInterval);
      disposeTensors();
    });
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
    // Run function with TensorFlow operations in a tidy scope
    const result = await tf.tidy(functionName, async () => {
      return await tfFunction();
    });
    
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
    disposeTensors();
    
    // Rethrow the error
    throw error;
  }
}

/**
 * Create a simple sequential model for signal processing with best practices
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
      padding: 'same',
      kernelInitializer: 'heNormal', // Better for ReLU activations
      useBias: true,
      biasInitializer: 'zeros'
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
      activation: 'linear',
      kernelInitializer: 'glorotNormal' // Better for linear activations
    }));
    
    // Compile the model with Adam optimizer
    model.compile({
      optimizer: tf.train.adam(0.001),
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
 * Get current memory usage statistics
 */
export function getMemoryUsage(): {
  current: { numTensors: number, numMB: number },
  history: typeof memoryUsageHistory
} {
  try {
    const memory = tf.memory();
    return {
      current: {
        numTensors: memory.numTensors,
        numMB: memory.numBytes / (1024 * 1024)
      },
      history: [...memoryUsageHistory]
    };
  } catch (error) {
    console.error('Error getting memory usage:', error);
    return {
      current: { numTensors: -1, numMB: -1 },
      history: []
    };
  }
}
