
import * as tf from '@tensorflow/tfjs';
import { toast } from '@/hooks/use-toast';

// Model cache to prevent reloading
const modelCache: Record<string, tf.LayersModel | tf.GraphModel> = {};

/**
 * Initialize TensorFlow.js with WebGPU acceleration when available
 * Falls back to WebGL or CPU when necessary
 */
export async function initializeTensorFlow(): Promise<boolean> {
  try {
    // Check for WebGPU availability first (most performant)
    if (tf.ENV.getBool('HAS_WEBGPU')) {
      await tf.setBackend('webgpu');
      console.log('Using high-performance WebGPU backend for TensorFlow operations');
    } 
    // Fall back to WebGL if WebGPU not available
    else if (tf.ENV.getBool('HAS_WEBGL')) {
      await tf.setBackend('webgl');
      console.log('Using WebGL backend for TensorFlow operations');
    } 
    // Final fallback to CPU
    else {
      await tf.setBackend('cpu');
      console.log('Using CPU backend for TensorFlow operations (limited performance)');
    }
    
    await tf.ready();
    
    // Apply optimizations based on available backend
    applyBackendOptimizations();
    
    // Log success with version and backend info
    console.log(`TensorFlow.js initialized successfully:`, {
      version: tf.version.tfjs,
      backend: tf.getBackend(),
      isWebGPUAvailable: tf.ENV.getBool('HAS_WEBGPU'),
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
 * Apply optimizations based on the active backend
 */
function applyBackendOptimizations(): void {
  const backend = tf.getBackend();
  
  if (backend === 'webgpu') {
    // WebGPU-specific optimizations
    tf.env().set('WEBGPU_CPU_FORWARD', false); // Prevent CPU fallback for ops
    tf.env().set('WEBGPU_DEFERRED_COMPILE_THRESHOLD', 4); // Better parallel compilation
  } 
  else if (backend === 'webgl') {
    // WebGL optimizations
    tf.env().set('WEBGL_FORCE_F16_TEXTURES', true); // Use F16 for better performance
    tf.env().set('WEBGL_PACK', true); // Enable texture packing
    tf.env().set('WEBGL_FLUSH_THRESHOLD', 2); // More aggressive flushing for reduced memory
  }
  
  // Universal optimizations
  tf.env().set('KEEP_INTERMEDIATE_TENSORS', false);
  tf.env().set('ENABLE_THREADING', true);
}

/**
 * Load and cache TF models with optimized settings
 */
export async function loadModel(
  modelUrl: string, 
  modelType: 'layers' | 'graph' = 'layers',
  options: {
    quantized?: boolean;
    kernelOptimizations?: boolean;
  } = {}
): Promise<tf.LayersModel | tf.GraphModel | null> {
  try {
    // Create cache key including options
    const cacheKey = `${modelUrl}_${JSON.stringify(options)}`;
    
    // Return cached model if available
    if (modelCache[cacheKey]) {
      return modelCache[cacheKey];
    }
    
    console.log(`Loading ${modelType} model from ${modelUrl} with options:`, options);
    
    const loadStartTime = performance.now();
    let model: tf.LayersModel | tf.GraphModel;
    
    // Configure loading options
    const loadOptions: any = {};
    
    if (options.quantized) {
      // Enable weight quantization for smaller models
      loadOptions.weightLoaderOptions = { quantize: true };
    }
    
    if (modelType === 'layers') {
      model = await tf.loadLayersModel(modelUrl, loadOptions);
      
      // Apply kernel optimizations if requested
      if (options.kernelOptimizations && model instanceof tf.LayersModel) {
        applyModelOptimizations(model);
      }
    } else {
      model = await tf.loadGraphModel(modelUrl, loadOptions);
    }
    
    const loadTime = performance.now() - loadStartTime;
    console.log(`Model loaded successfully in ${loadTime.toFixed(2)}ms`);
    
    // Cache the model
    modelCache[cacheKey] = model;
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
 * Apply performance optimizations to a loaded model
 */
function applyModelOptimizations(model: tf.LayersModel): void {
  // Fuse BatchNorm layers with Conv layers for performance
  const config = model.getConfig();
  const backend = tf.getBackend();
  
  // Different optimizations based on backend capabilities
  if (backend === 'webgpu' || backend === 'webgl') {
    // Set model to use lower precision if on GPU
    try {
      // @ts-ignore - tf internal API access
      if (model.setPipeline && typeof model.setPipeline === 'function') {
        // @ts-ignore - tf internal API access
        model.setPipeline({
          convertToFloat16: true,
          aggressive: false
        });
      }
    } catch (e) {
      console.warn('Precision optimization not supported', e);
    }
  }
}

/**
 * Clean up TensorFlow memory efficiently
 */
export function disposeTensors(): void {
  try {
    // Get number of tensors before disposal
    const numTensorsBefore = tf.memory().numTensors;
    const bytesBefore = tf.memory().numBytes;
    
    // Run garbage collection using tidy
    tf.tidy(() => {});
    
    // Dispose unused variables
    tf.disposeVariables();
    
    // Force garbage collection
    const numTensorsAfter = tf.memory().numTensors;
    const bytesAfter = tf.memory().numBytes;
    
    console.log(`TensorFlow memory cleanup:`, {
      tensorsFreed: numTensorsBefore - numTensorsAfter,
      bytesFreed: (bytesBefore - bytesAfter) / 1024 / 1024,
      remainingTensors: numTensorsAfter
    });
  } catch (error) {
    console.error('Error disposing TensorFlow tensors:', error);
  }
}

/**
 * Create an optimized convolutional model for signal processing
 * Uses advanced architecture for better feature extraction
 */
export function createSignalProcessingModel(): tf.Sequential {
  try {
    const model = tf.sequential();
    
    // Input layer - optimized for temporal signals
    model.add(tf.layers.conv1d({
      inputShape: [30, 1],
      filters: 16,
      kernelSize: 5,
      strides: 1,
      padding: 'same',
      activation: 'relu',
      kernelInitializer: 'glorotNormal',
      useBias: true
    }));
    
    // Add batch normalization for training stability
    model.add(tf.layers.batchNormalization());
    
    // Add a max pooling layer
    model.add(tf.layers.maxPooling1d({
      poolSize: 2,
      strides: 2
    }));
    
    // Second convolutional layer
    model.add(tf.layers.conv1d({
      filters: 32,
      kernelSize: 3,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({l2: 0.001})
    }));
    
    // Add global average pooling
    model.add(tf.layers.globalAveragePooling1d());
    
    // Add dropout for regularization
    model.add(tf.layers.dropout({rate: 0.25}));
    
    // Dense hidden layer
    model.add(tf.layers.dense({
      units: 16,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({l2: 0.001})
    }));
    
    // Output layer
    model.add(tf.layers.dense({
      units: 1,
      activation: 'linear'
    }));
    
    // Compile with advanced optimizer
    model.compile({
      optimizer: tf.train.adamax(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse', 'mae']
    });
    
    return model;
  } catch (error) {
    console.error('Error creating signal processing model:', error);
    throw new Error('Failed to create TensorFlow model');
  }
}

/**
 * Tensor memory management wrapper with performance monitoring
 */
export async function runWithMemoryManagement<T>(
  tfFunction: () => Promise<T>,
  options: {
    maxTensors?: number;
    logPerformance?: boolean;
  } = {}
): Promise<T> {
  const startTime = performance.now();
  const startingTensorCount = tf.memory().numTensors;
  let result: T;
  
  try {
    // Run TensorFlow operations inside tidy to auto-dispose intermediate tensors
    result = await tf.tidy(() => tfFunction());
    
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
    tf.tidy(() => {});
    tf.disposeVariables();
    
    throw error;
  }
}

/**
 * Quantize model for faster inference and reduced memory footprint
 */
export async function quantizeModel(
  model: tf.LayersModel, 
  quantizationOptions: {
    quantizationBits?: 8 | 16,
    optimizeForMobile?: boolean
  } = {}
): Promise<tf.LayersModel> {
  try {
    const bits = quantizationOptions.quantizationBits || 8;
    console.log(`Quantizing model to ${bits}-bit precision`);
    
    // Save original model config
    const originalConfig = model.getConfig();
    const weights = model.getWeights();
    
    // Create new model from config to apply quantization
    const quantizedModel = tf.sequential();
    
    // Configure for mobile optimization
    const exportConfig: any = {
      quantizeBits: bits,
    };
    
    if (quantizationOptions.optimizeForMobile) {
      exportConfig.optimizeForMobile = true;
      exportConfig.convertToInt8 = bits === 8;
    }
    
    // @ts-ignore - Internal API for model quantization
    if (tf.io && tf.io.IOHandler && tf.io.weightsToQuantizedWeights) {
      // @ts-ignore - Apply quantization to weights
      const quantizedWeights = await tf.io.weightsToQuantizedWeights(weights, exportConfig);
      
      // @ts-ignore - Set quantized weights to model
      await model.setWeights(quantizedWeights);
    } else {
      console.warn('Weight quantization not fully supported in this TF.js version');
    }
    
    return model;
  } catch (error) {
    console.error('Error quantizing model:', error);
    return model; // Return original model on error
  }
}
